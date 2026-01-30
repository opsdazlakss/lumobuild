import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { db } from '../../services/firebase';
import { 
  collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy, where 
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { playJoinSound, playLeaveSound, playScreenShareSound } from '../utils/voiceSounds';
import { useSoundboard } from '../../context/SoundboardContext';
import { useSpeakingIndicator } from '../hooks/useSpeakingIndicator';

const VoiceChannelContext = createContext();

export const useVoiceChannel = () => {
  const context = useContext(VoiceChannelContext);
  if (!context) {
    throw new Error('useVoiceChannel must be used within VoiceChannelProvider');
  }
  return context;
};

export const VoiceChannelProvider = ({ children }) => {
  const { currentUser, userProfile } = useAuth();
  const { currentServer, channels } = useData();
  
  // State
  const [currentVoiceChannel, setCurrentVoiceChannel] = useState(null);
  const [connectedServerId, setConnectedServerId] = useState(null); // Track which server we are connected to
  const [participants, setParticipants] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [peerConnections, setPeerConnections] = useState(new Map()); // odaId -> { odaId, stream }
  const [remoteStreams, setRemoteStreams] = useState(new Map()); // odaId -> stream
  
  // Devices
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState(null);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState(null);
  
  // Individual User Volumes (odaId -> volume 0.0 to 1.0)
  const [userVolumes, setUserVolumes] = useState(new Map());

  // Connection Quality
  const [currentPing, setCurrentPing] = useState(null);
  
  // Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // VAD (Voice Activity Detection) state
  // DISABLED by default - needs more sophisticated implementation
  // Current issue: when audio is disabled, can't detect speaking to re-enable
  const [vadEnabled, setVadEnabled] = useState(false); // Enable/disable VAD feature
  
  // Refs
  const peerRef = useRef(null);
  const myPeerIdRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const connectionsRef = useRef(new Map()); // peerId -> call
  const dataConnectionsRef = useRef(new Map()); // peerId -> dataConnection
  const activeSoundsRef = useRef([]); // Track active sound effects for cleanup
  const heartbeatIntervalRef = useRef(null); // Heartbeat interval for presence
  const latencyIntervalRef = useRef(null); // Ping/Latency check interval
  const cleanupIntervalRef = useRef(null); // Global ghost cleanup interval
  const currentVoiceChannelRef = useRef(null);
  const connectedServerIdRef = useRef(null);
  const latestParticipantsRef = useRef([]); // Track latest participants for intervals

  // Keep refs in sync for use in callbacks
  useEffect(() => {
    currentVoiceChannelRef.current = currentVoiceChannel;
  }, [currentVoiceChannel]);

  useEffect(() => {
    connectedServerIdRef.current = connectedServerId;
  }, [connectedServerId]);

  // Helper for handling received data (Soundboard)
  const handleData = useCallback((data) => {
    if (data && data.type === 'SOUND_EFFECT' && data.payload?.src) {
      console.log('[VoiceChannel] Received sound effect:', data.payload.name);
      const audio = new Audio(data.payload.src);
      audio.volume = 0.5;
      
      activeSoundsRef.current.push(audio);
      audio.onended = () => {
        activeSoundsRef.current = activeSoundsRef.current.filter(a => a !== audio);
      };

      audio.play().catch(e => console.error('[VoiceChannel] Error playing sound:', e));
    }
  }, []);

  // Initialize PeerJS
  useEffect(() => {
    if (!currentUser) return;

    const peer = new Peer();
    
    peer.on('open', (id) => {
      console.log('[VoiceChannel] My Peer ID:', id);
      myPeerIdRef.current = id;
      peerRef.current = peer;
    });

    // Handle incoming data connections (for soundboard)
    peer.on('connection', (conn) => {
      console.log('[VoiceChannel] Incoming data connection from:', conn.peer);
      
      conn.on('open', () => {
        dataConnectionsRef.current.set(conn.peer, conn);
      });

      conn.on('data', handleData);

      conn.on('close', () => {
        dataConnectionsRef.current.delete(conn.peer);
      });
    });

    // Handle incoming calls from other participants
    peer.on('call', (call) => {
      console.log('[VoiceChannel] Incoming call from:', call.peer);
      
      // Answer with our stream
      const stream = localStreamRef.current;
      if (stream) {
        call.answer(stream);
      } else {
        call.answer();
      }

      call.on('stream', (remoteStream) => {
        console.log('[VoiceChannel] Received remote stream from:', call.peer);
        setRemoteStreams(prev => new Map(prev).set(call.peer, remoteStream));
      });

      call.on('close', () => {
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(call.peer);
          return newMap;
        });
      });

      connectionsRef.current.set(call.peer, call);
    });

    peer.on('error', (err) => {
      console.error('[VoiceChannel] Peer error details:', {
        type: err.type,
        message: err.message,
        targetPeer: err.peer
      });
      
      // GHOST USER KICK: If we can't connect to a peer, they are likely a ghost
      if (err.type === 'peer-unavailable' || err.message?.includes('Could not connect to peer')) {
        // Extract peer ID either from err.peer or from the message
        let peerId = err.peer;
        if (!peerId) {
          const match = err.message.match(/peer\s+([a-zA-Z0-9-]+)/);
          if (match) peerId = match[1];
        }

        if (peerId && currentVoiceChannelRef.current && connectedServerIdRef.current) {
           console.log('[VoiceChannel] Proactively removing ghost peer:', peerId);
           
           // Remove from local state immediately for snappy UI
           setParticipants(prev => {
             const participant = prev.find(p => p.peerId === peerId);
             if (participant && participant.odaId) {
               console.log('[VoiceChannel] Cleaning up Firestore for ghost:', participant.displayName);
               const staleParticipantRef = doc(
                 db, 'servers', connectedServerIdRef.current, 'channels', currentVoiceChannelRef.current, 'voiceParticipants', participant.odaId
               );
               deleteDoc(staleParticipantRef).catch(() => {});
             }
             return prev.filter(p => p.peerId !== peerId);
           });
        }
      }
    });

    return () => {
      // Stop all active soundboard sounds
      activeSoundsRef.current.forEach(audio => {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch (e) {}
      });
      activeSoundsRef.current = [];

      peer.destroy();
      peerRef.current = null;
      myPeerIdRef.current = null;
    };
  }, [currentUser]);

  // Enumerate devices
  const refreshDevices = useCallback(async () => {
    // Check if mediaDevices API is available
    if (!navigator.mediaDevices) {
      console.log('[VoiceChannel] mediaDevices API not available - skipping device enumeration');
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      
      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);
      
      // Auto-select first if none selected
      if (!selectedAudioDeviceId && audioInputs.length > 0) {
        setSelectedAudioDeviceId(audioInputs[0].deviceId);
      }
      if (!selectedVideoDeviceId && videoInputs.length > 0) {
        setSelectedVideoDeviceId(videoInputs[0].deviceId);
      }
    } catch (err) {
      console.error('[VoiceChannel] Failed to refresh devices:', err);
    }
  }, [selectedAudioDeviceId, selectedVideoDeviceId]);

  useEffect(() => {
    // Check if mediaDevices API is available
    if (!navigator.mediaDevices) {
      console.log('[VoiceChannel] mediaDevices API not available - skipping device enumeration');
      return;
    }

    refreshDevices();
    // Listen for device changes
    navigator.mediaDevices.ondevicechange = refreshDevices;
    return () => {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.ondevicechange = null;
      }
    };
  }, [refreshDevices]);

  // VAD: Voice Activity Detection for local stream
  // Only apply VAD when not muted and VAD is enabled
  const shouldCheckVAD = !isMuted && vadEnabled && localStream;
  const isSpeakingLocal = useSpeakingIndicator(
    shouldCheckVAD ? localStream : null,
    { threshold: 15, interval: 50 } // Check more frequently for VAD (50ms)
  );

  // Apply VAD: disable audio track when not speaking to save bandwidth
  useEffect(() => {
    if (!localStreamRef.current || !vadEnabled || isMuted) return;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (!audioTrack) return;

    // Enable track when speaking, disable when silent
    // Note: We keep the track object alive, just toggle enabled state
    // This is different from mute - mute is user-controlled, VAD is automatic
    if (isSpeakingLocal) {
      if (!audioTrack.enabled) {
        audioTrack.enabled = true;
        console.log('[VAD] Audio enabled - speaking detected');
      }
    } else {
      if (audioTrack.enabled) {
        audioTrack.enabled = false;
        console.log('[VAD] Audio disabled - silence detected');
      }
    }
  }, [isSpeakingLocal, vadEnabled, isMuted]);

  // Handle active audio device change
  const changeAudioDevice = useCallback(async (deviceId) => {
    setSelectedAudioDeviceId(deviceId);
    
    // If not in a call, just update the state
    if (!currentVoiceChannel || !localStreamRef.current) return;

    try {
      // Get new stream with selected device
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: isVideoOn
      });

      // Stop current tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      localStreamRef.current = newStream;
      setLocalStream(newStream);

      // Re-apply mute state to new stream
      const audioTrack = newStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMuted;
      }

      // Reconnect to all peers with new stream
      connectionsRef.current.forEach((call, peerId) => {
        // Redial peer with the new stream
        const newCall = peerRef.current.call(peerId, newStream);
        if (newCall) {
          newCall.on('stream', (remoteStream) => {
            setRemoteStreams(prev => new Map(prev).set(peerId, remoteStream));
          });
          connectionsRef.current.set(peerId, newCall);
        }
      });
      
      console.log('[VoiceChannel] Switched to audio device:', deviceId);
    } catch (err) {
      console.error('[VoiceChannel] Failed to switch audio device:', err);
    }
  }, [currentVoiceChannel, isVideoOn, isMuted]);

  // Handle active video device change
  const changeVideoDevice = useCallback(async (deviceId) => {
    setSelectedVideoDeviceId(deviceId);
    
    // If we're not using video right now, we just update the choice
    if (!currentVoiceChannel || !localStreamRef.current || !isVideoOn) return;

    try {
      // Get new video track with selected device
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : true,
        video: { deviceId: { exact: deviceId } }
      });

      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        // Stop old video track
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldTrack) oldTrack.stop();
        
        // Remove old and add new
        if (oldTrack) localStreamRef.current.removeTrack(oldTrack);
        localStreamRef.current.addTrack(videoTrack);
        
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

        // Update peers
        connectionsRef.current.forEach((call, peerId) => {
          const newCall = peerRef.current.call(peerId, localStreamRef.current);
          if (newCall) {
            newCall.on('stream', (remoteStream) => {
              setRemoteStreams(prev => new Map(prev).set(peerId, remoteStream));
            });
            connectionsRef.current.set(peerId, newCall);
          }
        });
      }
      
      console.log('[VoiceChannel] Switched to video device:', deviceId);
    } catch (err) {
      console.error('[VoiceChannel] Failed to switch video device:', err);
    }
  }, [currentVoiceChannel, isVideoOn, selectedAudioDeviceId]);

  // Listen to voice participants in current channel
  const prevParticipantsRef = useRef([]);
  const prevScreenSharersRef = useRef(new Set());
  
  // Listen for participants
  useEffect(() => {
    if (!currentVoiceChannel || !connectedServerId) {
      setParticipants([]);
      prevParticipantsRef.current = [];
      prevScreenSharersRef.current = new Set();
      return;
    }

    const participantsRef = collection(
      db, 'servers', connectedServerId, 'channels', currentVoiceChannel, 'voiceParticipants'
    );
    const q = query(participantsRef, orderBy('joinedAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const participantsData = [];
      snapshot.forEach((doc) => {
        participantsData.push({ odaId: doc.id, ...doc.data() });
      });
      
      // Check for join/leave sounds (only for other users)
      const prevIds = new Set(prevParticipantsRef.current.map(p => p.odaId));
      const currentIds = new Set(participantsData.map(p => p.odaId));
      
      // Someone joined
      participantsData.forEach(p => {
        if (!prevIds.has(p.odaId) && p.odaId !== currentUser?.uid) {
          playJoinSound();
        }
      });
      
      // Someone left
      prevParticipantsRef.current.forEach(p => {
        if (!currentIds.has(p.odaId) && p.odaId !== currentUser?.uid) {
          playLeaveSound();
        }
      });
      
      // Check for screen share sounds
      const currentScreenSharers = new Set(
        participantsData.filter(p => p.isScreenSharing).map(p => p.odaId)
      );
      
      currentScreenSharers.forEach(id => {
        if (!prevScreenSharersRef.current.has(id) && id !== currentUser?.uid) {
          playScreenShareSound();
        }
      });
      
      prevParticipantsRef.current = participantsData;
      prevScreenSharersRef.current = currentScreenSharers;
      
      // GHOST USER FIX: Aggressive local filtering
      const now = Date.now();
      const activeParticipants = participantsData.filter(participant => {
        // Current user is always active locally
        if (participant.odaId === currentUser?.uid) return true;
        
        // Handle heartbeat (could be Firestore Timestamp or number)
        const lastHeartbeatTime = participant.lastHeartbeat?.toMillis 
          ? participant.lastHeartbeat.toMillis() 
          : (participant.lastHeartbeat || (participant.joinedAt?.toMillis ? participant.joinedAt.toMillis() : Date.now()));
        
        const timeSinceHeartbeat = now - lastHeartbeatTime;

        // If no heartbeat/joined recently for 30 seconds, filter out from UI
        if (timeSinceHeartbeat > 30000) {
          console.log('[VoiceChannel] Filtering ghost participant locally (no activity):', participant.displayName);
          
          // Try to clean up Firestore too (idempotent)
          const staleParticipantRef = doc(
            db, 'servers', connectedServerId, 'channels', currentVoiceChannel, 'voiceParticipants', participant.odaId
          );
          deleteDoc(staleParticipantRef).catch(() => {});
          
          return false;
        }
        return true;
      });

      // Update remote streams map based on filtered participants
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        for (const [peerId] of prev) {
          const stillExists = activeParticipants.some(p => p.peerId === peerId || p.odaId === peerId);
          if (!stillExists) {
            newMap.delete(peerId);
          }
        }
        return newMap;
      });

      // Connect to new participants
      activeParticipants.forEach((participant) => {
        if (participant.odaId !== currentUser?.uid && participant.peerId) {
          if (!connectionsRef.current.has(participant.peerId) && peerRef.current && localStreamRef.current) {
            console.log('[VoiceChannel] Calling peer:', participant.peerId);
            const call = peerRef.current.call(participant.peerId, localStreamRef.current);
            
            if (call) {
              call.on('stream', (remoteStream) => {
                setRemoteStreams(prev => new Map(prev).set(participant.peerId, remoteStream));
              });

              call.on('close', () => {
                setRemoteStreams(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(participant.peerId);
                  return newMap;
                });
              });

              connectionsRef.current.set(participant.peerId, call);
            }

            // Also open Data Connection for soundboard
            if (!dataConnectionsRef.current.has(participant.peerId)) {
              const conn = peerRef.current.connect(participant.peerId);
              if (conn) {
                conn.on('open', () => {
                  dataConnectionsRef.current.set(participant.peerId, conn);
                });
                conn.on('data', handleData);
                conn.on('close', () => {
                  dataConnectionsRef.current.delete(participant.peerId);
                });
              }
            }
          }
        }
      });

      // Clean up disconnected participants
      const activePeerIds = new Set(activeParticipants.map(p => p.peerId));
      connectionsRef.current.forEach((call, peerId) => {
        if (!activePeerIds.has(peerId)) {
          call.close();
          connectionsRef.current.delete(peerId);
          
          const dataConn = dataConnectionsRef.current.get(peerId);
          if (dataConn) {
            dataConn.close();
            dataConnectionsRef.current.delete(peerId);
          }
        }
      });

      setParticipants(activeParticipants);
      prevParticipantsRef.current = activeParticipants;
      // CRITICAL: We store the RAW data here so the cleanup interval can see "ghosts" 
      // even if they are already filtered out from the active UI participants.
      latestParticipantsRef.current = participantsData;
    });

    return () => unsubscribe();
  }, [currentVoiceChannel, connectedServerId, currentUser, handleData]);

  // Join voice channel
  const joinVoiceChannel = useCallback(async (channelId) => {
    if (!currentUser || !currentServer || !peerRef.current || !myPeerIdRef.current) {
      console.error('[VoiceChannel] Cannot join: missing requirements');
      return;
    }

    try {
      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      setLocalStream(stream);
      localStreamRef.current = stream;

      // Add participant to Firestore
      const participantRef = doc(
        db, 'servers', currentServer, 'channels', channelId, 'voiceParticipants', currentUser.uid
      );

      await setDoc(participantRef, {
        odaId: currentUser.uid,
        peerId: myPeerIdRef.current,
        displayName: userProfile?.displayName || currentUser.displayName || 'User',
        photoUrl: userProfile?.photoUrl || userProfile?.photoURL || null,
        joinedAt: serverTimestamp(),
        isMuted: false,
        isVideoOn: false,
        isScreenSharing: false
      });

      // GHOST USER FIX: Setup heartbeat-based presence system
      // Update lastHeartbeat every 5 seconds to show we're still connected
      const updateHeartbeat = async () => {
        if (currentVoiceChannel && currentUser && connectedServerId) {
          try {
            const participantRef = doc(
              db, 'servers', connectedServerId, 'channels', currentVoiceChannel, 'voiceParticipants', currentUser.uid
            );
            await setDoc(participantRef, { 
              lastHeartbeat: serverTimestamp() 
            }, { merge: true });
          } catch (err) {
            console.error('[VoiceChannel] Heartbeat failed:', err);
          }
        }
      };

      // Initial heartbeat
      await updateHeartbeat();

      // Setup heartbeat interval (every 5 seconds)
      heartbeatIntervalRef.current = setInterval(updateHeartbeat, 5000);
      console.log('[VoiceChannel] Heartbeat started');
      
      // GLOBAL GHOST CLEANUP: Check all participants every 10 seconds
      const runGlobalCleanup = async () => {
        if (!currentVoiceChannelRef.current || !connectedServerIdRef.current) return;
        
        const now = Date.now();
        const participantsToCheck = latestParticipantsRef.current;
        
        // Debug log to show the monitor is alive
        if (participantsToCheck.length > 0) {
          console.log(`[VoiceChannel] Ghost Monitor: checking ${participantsToCheck.length} total entries...`);
        }

        latestParticipantsRef.current.forEach(participant => {
          // Don't clean up ourself
          if (participant.odaId === currentUser?.uid) return;
          
          const lastActivity = participant.lastHeartbeat || participant.joinedAt;
          const lastActivityTime = lastActivity?.toMillis 
            ? lastActivity.toMillis() 
            : (lastActivity || 0);
          
          if (lastActivityTime === 0) {
            // console.warn('[VoiceChannel] Participant has no activity time:', participant.displayName);
            return;
          }

          const timeSinceActivity = now - lastActivityTime;
          
          // If no activity for 20 seconds, they are definitively gone
          if (timeSinceActivity > 20000) {
            console.log('[VoiceChannel] Interval cleanup removing ghost:', participant.displayName, `(${Math.round(timeSinceActivity/1000)}s idle)`);
            const staleParticipantRef = doc(
              db, 'servers', connectedServerIdRef.current, 'channels', currentVoiceChannelRef.current, 'voiceParticipants', participant.odaId
            );
            
            // Delete from Firestore
            deleteDoc(staleParticipantRef).catch(err => console.error('[VoiceChannel] Failed to delete ghost:', err));

            // Also remove from local state immediately for snappy UI
            setParticipants(prev => prev.filter(p => p.odaId !== participant.odaId));
          }
        });
      };

      cleanupIntervalRef.current = setInterval(runGlobalCleanup, 10000);
      console.log('[VoiceChannel] Global cleanup interval started');

      // LATENCY MONITOR: Check ping every 2 seconds
      // Using a separate interval for checking network stats
      const monitorNetworkStats = async () => {
        if (!connectionsRef.current.size) {
           setCurrentPing(null);
           return;
        }

        let totalRtt = 0;
        let count = 0;

        // Use map of promises to wait for all stats
        const statPromises = Array.from(connectionsRef.current.values()).map(async (call) => {
          if (!call.peerConnection) return;
          try {
            const stats = await call.peerConnection.getStats();
            let pairFound = false;

            stats.forEach(report => {
              // Debug: Log ALL report types to see what we get
              // if (report.type === 'candidate-pair') console.log('Candidate Pair:', report);

              if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                pairFound = true;
                
                 if (report.currentRoundTripTime !== undefined) {
                   totalRtt += Math.round(report.currentRoundTripTime * 1000);
                   count++;
                 } else if (report.roundTripTime !== undefined) {
                   totalRtt += Math.round(report.roundTripTime * 1000);
                   count++;
                 }
              }
            });
            
            if (!pairFound) {
               // Fallback: search for ANY candidate-pair with RTT
               stats.forEach(report => {
                 if (report.type === 'candidate-pair' && (report.currentRoundTripTime || report.roundTripTime)) {
                    const rttVal = report.currentRoundTripTime || report.roundTripTime;
                    totalRtt += Math.round(rttVal * 1000);
                    count++;
                 }
               });
            }

          } catch (e) {
            console.warn('[VoiceChannel] Stats error:', e);
          }
        });

        await Promise.all(statPromises);

        if (count > 0) {
          const avgPing = Math.round(totalRtt / count);
          setCurrentPing(avgPing);
        }
      };

      latencyIntervalRef.current = setInterval(monitorNetworkStats, 2000); // Check every 2s

      setCurrentVoiceChannel(channelId);
      setConnectedServerId(currentServer); // Set the connected server
      setIsMuted(false);
      setIsVideoOn(false);
      setIsScreenSharing(false);

      // Play join sound for self
      playJoinSound();

      console.log('[VoiceChannel] Joined channel:', channelId);
    } catch (err) {
      console.error('[VoiceChannel] Failed to join:', err);
    }
  }, [currentUser, currentServer, userProfile, selectedAudioDeviceId]);

  const isLeavingRef = useRef(false);

  // Leave voice channel
  const leaveVoiceChannel = useCallback(async () => {
    // Prevent double execution or if already disconnected
    if (isLeavingRef.current || !currentVoiceChannel || !currentUser || !connectedServerId) return;

    try {
      isLeavingRef.current = true; // Lock

      // Stop heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
        console.log('[VoiceChannel] Heartbeat stopped');
      }
      
      // Stop cleanup monitor
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = null;
      }
      
      // Stop latency monitor
      if (latencyIntervalRef.current) {
        clearInterval(latencyIntervalRef.current);
        latencyIntervalRef.current = null; 
      }

      // Remove from Firestore
      const participantRef = doc(
        db, 'servers', connectedServerId, 'channels', currentVoiceChannel, 'voiceParticipants', currentUser.uid
      );
      await deleteDoc(participantRef);

      // Stop ALL tracks from local stream (audio + video)
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('[VoiceChannel] Stopped track:', track.kind);
        });
        localStreamRef.current = null;
        setLocalStream(null);
      }

      // Stop screen share stream
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('[VoiceChannel] Stopped screen track:', track.kind);
        });
        screenStreamRef.current = null;
        setScreenStream(null);
      }

      // Close all peer connections
      connectionsRef.current.forEach((call) => call.close());
      connectionsRef.current.clear();
      dataConnectionsRef.current.forEach((conn) => conn.close());
      dataConnectionsRef.current.clear();

      // Clear all state
      setRemoteStreams(new Map());
      setCurrentVoiceChannel(null);
      setConnectedServerId(null);
      setParticipants([]);
      setIsVideoOn(false);
      setIsScreenSharing(false);
      setIsMuted(false);
      setIsDeafened(false);

      // Stop all active soundboard sounds
      if (activeSoundsRef.current.length > 0) {
        console.log('[VoiceChannel] Stopping', activeSoundsRef.current.length, 'active sounds');
        activeSoundsRef.current.forEach(audio => {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch (e) {
            console.error('[VoiceChannel] Error stopping sound:', e);
          }
        });
        activeSoundsRef.current = [];
      }

      // Play leave sound for self
      playLeaveSound();

      console.log('[VoiceChannel] Left channel - all media stopped');
    } catch (err) {
      console.error('[VoiceChannel] Failed to leave:', err);
    } finally {
      // Small delay before unlocking to ensure state updates propagate
      setTimeout(() => {
        isLeavingRef.current = false;
      }, 500);
    }
  }, [currentVoiceChannel, currentUser, connectedServerId]);

  // Handle window closure/refresh (Ghost User Fix)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentVoiceChannel) {
        leaveVoiceChannel();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentVoiceChannel, leaveVoiceChannel]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const newMutedState = !isMuted;
        setIsMuted(newMutedState);
        
        // When muting, always disable track
        // When unmuting, VAD will handle enabling if speaking
        if (newMutedState) {
          audioTrack.enabled = false;
        } else if (!vadEnabled) {
          // If VAD is disabled, enable immediately on unmute
          audioTrack.enabled = true;
        }
        // If VAD is enabled, the VAD useEffect will handle enabling when speaking

        // Update Firestore
        if (currentVoiceChannel && currentUser && connectedServerId) {
          const participantRef = doc(
            db, 'servers', connectedServerId, 'channels', currentVoiceChannel, 'voiceParticipants', currentUser.uid
          );
          setDoc(participantRef, { isMuted: newMutedState }, { merge: true });
        }
      }
    }
  }, [currentVoiceChannel, currentUser, connectedServerId, isMuted, vadEnabled]);

  // Toggle deafen
  // Toggle deafen
  const toggleDeafen = useCallback(() => {
    setIsDeafened(prev => {
      const isNowDeafened = !prev;
      
      // If we are deafening, mute if not muted
      if (isNowDeafened) {
          if (!isMuted) toggleMute();
      } else {
          // If undeafening, user wants mic to open too
          if (isMuted) toggleMute();
      }

      // Mute all remote audio tracks
      remoteStreams.forEach((stream) => {
        stream.getAudioTracks().forEach(track => {
          track.enabled = !isNowDeafened;
        });
      });
      return isNowDeafened;
    });
  }, [remoteStreams, isMuted, toggleMute]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current || !currentVoiceChannel) return;

    try {
      if (isVideoOn) {
        // Turn off video
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.stop();
          localStreamRef.current.removeTrack(videoTrack);
        }
        setIsVideoOn(false);
      } else {
        // Turn on video
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        localStreamRef.current.addTrack(videoTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        setIsVideoOn(true);

        // Reconnect to all peers with new stream
        connectionsRef.current.forEach((call, peerId) => {
          const newCall = peerRef.current.call(peerId, localStreamRef.current);
          if (newCall) {
            newCall.on('stream', (remoteStream) => {
              setRemoteStreams(prev => new Map(prev).set(peerId, remoteStream));
            });
            connectionsRef.current.set(peerId, newCall);
          }
        });
      }

      // Update Firestore
      if (currentUser && connectedServerId) {
        const participantRef = doc(
          db, 'servers', connectedServerId, 'channels', currentVoiceChannel, 'voiceParticipants', currentUser.uid
        );
        setDoc(participantRef, { isVideoOn: !isVideoOn }, { merge: true });
      }
    } catch (err) {
      console.error('[VoiceChannel] Failed to toggle video:', err);
    }
  }, [isVideoOn, currentVoiceChannel, currentUser, connectedServerId]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async (options = null) => {
    if (!currentVoiceChannel) return;

    try {
      // If options is null and already sharing, stop sharing
      if (isScreenSharing || options === null && screenStreamRef.current) {
        // Stop screen share
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }
        setIsScreenSharing(false);
        setScreenStream(null);
        
        // Update Firestore
        if (currentUser && connectedServerId) {
          const participantRef = doc(
            db, 'servers', connectedServerId, 'channels', currentVoiceChannel, 'voiceParticipants', currentUser.uid
          );
          setDoc(participantRef, { isScreenSharing: false }, { merge: true });
        }
        return;
      }
      
      // Start screen share with options from ScreenShareModal
      let screenStream;
      
      // PERFORMANCE FIX: Lower default values for smoother experience
      // Premium users can use higher quality via options
      const videoConstraints = {
        width: options?.width || 960,      // Reduced from 1280
        height: options?.height || 540,    // Reduced from 720
        frameRate: options?.frameRate || 15 // Reduced from 30
      };

      console.log('[VoiceChannel] Screen share starting with constraints:', videoConstraints);

      // For Electron with sourceId
      if (options?.sourceId) {
        // ELECTRON: Don't capture system audio - causes unwanted sounds from other apps
        screenStream = await navigator.mediaDevices.getUserMedia({
          audio: false, // No system audio for Electron
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: options.sourceId,
              maxWidth: videoConstraints.width,
              maxHeight: videoConstraints.height,
              maxFrameRate: videoConstraints.frameRate
            }
          }
        });
      } else {
        // WEB: Use getDisplayMedia - user can choose to share audio
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: videoConstraints.width },
            height: { ideal: videoConstraints.height },
            frameRate: { ideal: videoConstraints.frameRate },
            cursor: 'always'
          },
          audio: {
            // System audio settings - reduced quality to prevent echo
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false
          }
        });
      }

      // FIX: Mix microphone audio with screen share
      // This ensures your voice is heard during screen share
      const screenVideoTrack = screenStream.getVideoTracks()[0];
      const screenAudioTrack = screenStream.getAudioTracks()[0]; // May be undefined if user didn't share audio
      
      // Get current microphone audio from local stream
      const micAudioTrack = localStreamRef.current?.getAudioTracks()[0];
      
      let finalAudioTrack = null;
      
      if (micAudioTrack && screenAudioTrack) {
        // Mix both: microphone + system audio
        console.log('[VoiceChannel] Mixing microphone and system audio');
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const destination = audioContext.createMediaStreamDestination();
          
          // Create sources
          const micSource = audioContext.createMediaStreamSource(new MediaStream([micAudioTrack]));
          const screenSource = audioContext.createMediaStreamSource(new MediaStream([screenAudioTrack]));
          
          // Create gain nodes for volume control
          const micGain = audioContext.createGain();
          const screenGain = audioContext.createGain();
          
          micGain.gain.value = 1.0;      // Full mic volume
          screenGain.gain.value = 0.5;   // Reduced system audio to not overpower voice
          
          // Connect
          micSource.connect(micGain);
          screenSource.connect(screenGain);
          micGain.connect(destination);
          screenGain.connect(destination);
          
          finalAudioTrack = destination.stream.getAudioTracks()[0];
        } catch (e) {
          console.error('[VoiceChannel] Audio mixing failed, using mic only:', e);
          finalAudioTrack = micAudioTrack;
        }
      } else if (micAudioTrack) {
        // Only microphone (no system audio selected or Electron)
        console.log('[VoiceChannel] Using microphone audio only');
        finalAudioTrack = micAudioTrack;
      } else if (screenAudioTrack) {
        // Only system audio (no mic available)
        console.log('[VoiceChannel] Using system audio only');
        finalAudioTrack = screenAudioTrack;
      }
      
      // Create final stream with video + mixed audio
      const finalStream = new MediaStream([screenVideoTrack]);
      if (finalAudioTrack) {
        finalStream.addTrack(finalAudioTrack);
      }

      screenStreamRef.current = finalStream;

      // Handle when user stops sharing via browser UI
      screenVideoTrack.onended = () => {
        setIsScreenSharing(false);
        setScreenStream(null);
        screenStreamRef.current = null;
        
        // Update Firestore
        if (currentUser && connectedServerId && currentVoiceChannel) {
          const participantRef = doc(
            db, 'servers', connectedServerId, 'channels', currentVoiceChannel, 'voiceParticipants', currentUser.uid
          );
          setDoc(participantRef, { isScreenSharing: false }, { merge: true });
        }
      };

      // Reconnect to all peers with the combined stream (video + audio)
      connectionsRef.current.forEach((call, peerId) => {
        const newCall = peerRef.current.call(peerId, finalStream);
        if (newCall) {
          newCall.on('stream', (remoteStream) => {
            setRemoteStreams(prev => new Map(prev).set(peerId, remoteStream));
          });
        }
      });

      setIsScreenSharing(true);
      setScreenStream(finalStream);

      // Play screen share sound for self
      playScreenShareSound();
      
      // Update Firestore
    if (currentUser && connectedServerId) {
      const participantRef = doc(
        db, 'servers', connectedServerId, 'channels', currentVoiceChannel, 'voiceParticipants', currentUser.uid
      );
      setDoc(participantRef, { isScreenSharing: true }, { merge: true });
    }
  } catch (err) {
    console.error('[VoiceChannel] Failed to toggle screen share:', err);
  }
}, [isScreenSharing, currentVoiceChannel, currentUser, connectedServerId, localStreamRef, screenStreamRef, connectionsRef, dataConnectionsRef, remoteStreams, setRemoteStreams, setIsScreenSharing, setScreenStream, playScreenShareSound]);

  // Get voice channels from current server
  const voiceChannels = channels?.filter(ch => ch.type === 'voice') || [];

  // Cleanup on unmount or server change
  // Cleanup on unmount or channel change
  useEffect(() => {
    return () => {
      if (currentVoiceChannel) {
        leaveVoiceChannel();
      }
    };
  }, [currentVoiceChannel, connectedServerId]);

  const { customSounds } = useSoundboard();

  // Broadcast soundboard sound
  const playSound = useCallback((soundId) => {
    const sound = customSounds.find(s => s.id === soundId);
    if (!sound) return;

    // 1. Play locally
    const audio = new Audio(sound.src);
    audio.volume = 0.5;
    activeSoundsRef.current.push(audio);
    
    audio.onended = () => {
      activeSoundsRef.current = activeSoundsRef.current.filter(a => a !== audio);
    };
    
    audio.play().catch(e => console.error("[VoiceChannel] Error playing sound locally:", e));

    // 2. Broadcast to all peers
    dataConnectionsRef.current.forEach((conn, peerId) => {
      if (conn.open) {
        console.log('[VoiceChannel] Broadcasting sound to:', peerId);
        conn.send({ 
          type: 'SOUND_EFFECT', 
          payload: { src: sound.src, name: sound.name } 
        });
      }
    });
  }, [customSounds]);

  const value = {
    // State
    currentVoiceChannel,
    connectedServerId,
    participants,
    localStream,
    screenStream,
    remoteStreams,
    voiceChannels,
    currentPing, // Export ping state
    
    // Controls
    isMuted,
    isDeafened,
    isVideoOn,
    isScreenSharing,
    audioDevices,
    selectedAudioDeviceId,
    vadEnabled,
    
    // Actions
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleDeafen,
    toggleVideo,
    toggleScreenShare,
    changeAudioDevice,
    videoDevices,
    selectedVideoDeviceId,
    changeVideoDevice,
    refreshDevices,
    userVolumes,
    setUserVolume: (odaId, volume) => {
      setUserVolumes(prev => {
        const newMap = new Map(prev);
        newMap.set(odaId, volume);
        return newMap;
      });
    },
    playSound,
    toggleVAD: () => setVadEnabled(prev => !prev)
  };

  return (
    <VoiceChannelContext.Provider value={value}>
      {children}
      {/* Audio elements for remote streams - hidden but necessary for playback */}
      <AudioPlayer 
        remoteStreams={remoteStreams} 
        isDeafened={isDeafened} 
        participants={participants}
        userVolumes={userVolumes}
      />
    </VoiceChannelContext.Provider>
  );
};

const AudioPlayer = ({ remoteStreams, isDeafened, participants, userVolumes }) => {
  return (
    <div style={{ display: 'none' }}>
      {Array.from(remoteStreams.entries()).map(([peerId, stream]) => {
        const participant = participants.find(p => p.peerId === peerId);
        const odaId = participant?.odaId;
        const volume = odaId ? (userVolumes.get(odaId) ?? 1.0) : 1.0;
        
        return (
          <AudioElement 
            key={peerId} 
            stream={stream} 
            muted={isDeafened} 
            volume={volume}
          />
        );
      })}
    </div>
  );
};

// Individual audio element for each remote stream
const AudioElement = ({ stream, muted, volume }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      // Try to play (may require user interaction first)
      audioRef.current.play().catch(err => {
        console.log('[VoiceChannel] Audio autoplay blocked:', err);
      });
    }
  }, [stream]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted;
    }
  }, [muted]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  return <audio ref={audioRef} autoPlay playsInline />;
};
