import { createContext, useContext, useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { db } from '../services/firebase';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { playIncomingRing, playOutgoingRing, stopRing } from '../utils/callSounds';
import { hasCapability, CAPABILITIES } from '../utils/permissions';

// Custom Soundboard Limits
const MAX_SOUNDS = 10;
const MAX_SOUND_SIZE_KB = 300; // Limit per sound to prevent lag storage issues

const CallContext = createContext();

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within CallProvider');
  }
  return context;
};

export const CallProvider = ({ children }) => {
  const { currentUser, userProfile } = useAuth();
  const { error: showError } = useToast();
  
  const [peer, setPeer] = useState(null);
  const [myPeerId, setMyPeerId] = useState(null);
  const [callStatus, setCallStatus] = useState('idle'); // idle, incoming, outgoing, connected
  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCallUser, setOutgoingCallUser] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [dataConnection, setDataConnection] = useState(null); // P2P Data Channel for Soundboard
  
  // Voice Room State
  const [activeRoom, setActiveRoom] = useState(null); // { channelId, serverId }
  const activeRoomRef = useRef(null);
  const [roomPeers, setRoomPeers] = useState({}); // { [peerId]: { call, stream, userId } }
  const roomPeersRef = useRef({}); // Ref for async access
  
  // Voice Activity Detection
  const [talkingPeers, setTalkingPeers] = useState({}); // { [peerId]: boolean } ("me" for local)
  const audioCtxRef = useRef(null);
  const analysersRef = useRef({}); // { [peerId]: AnalyserNode }
  const analyzeIntervalRef = useRef(null);
  
  // Volume Control State
  const [peerVolumes, setPeerVolumes] = useState(() => {
    try {
        const saved = localStorage.getItem('dss_user_volumes');
        return saved ? JSON.parse(saved) : {};
    } catch(e) { return {}; }
  }); 
  const [inputVolume, setInputVolume] = useState(1); 
  const inputGainNodeRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('dss_user_volumes', JSON.stringify(peerVolumes));
  }, [peerVolumes]);

  const setPeerVolume = (peerId, volume) => {
      setPeerVolumes(prev => ({ ...prev, [peerId]: volume }));
  };

  // Initialize/Cleanup Audio Analysis
  useEffect(() => {
    if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    const checkAudioLevels = () => {
        // If in LiveKit Room (activeRoom), let LiveKit handle VAD via ActiveSpeakersChanged event.
        // Disable legacy P2P VAD to prevent overwriting state.
        if (activeRoom) return;

        const threshold = 0.05; // Sensitivity
        const newTalking = { ...talkingPeers };
        let changed = false;

        // Helper to check volume
        const getVolume = (analyser) => {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            return sum / dataArray.length / 255; // Normalized 0-1
        };

        // 1. Check Local Stream
        if (analysersRef.current['me']) {
            const vol = getVolume(analysersRef.current['me']);
            const isTalking = vol > threshold;
            if (newTalking['me'] !== isTalking) {
                newTalking['me'] = isTalking;
                changed = true;
            }
        }

        // 2. Check Remote Streams
        Object.keys(analysersRef.current).forEach(peerId => {
            if (peerId === 'me') return;
            const vol = getVolume(analysersRef.current[peerId]);
            const isTalking = vol > threshold;
            if (newTalking[peerId] !== isTalking) {
                newTalking[peerId] = isTalking;
                changed = true;
            }
        });

        if (changed) {
            setTalkingPeers(newTalking);
        }
    };

    analyzeIntervalRef.current = setInterval(checkAudioLevels, 100);

    return () => {
        if (analyzeIntervalRef.current) clearInterval(analyzeIntervalRef.current);
    };
  }, []);

  // Update Analysers when streams change
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    // Local Stream Analyser
    if (localStream && localStream.getAudioTracks().length > 0 && !analysersRef.current['me']) {
        const source = ctx.createMediaStreamSource(localStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analysersRef.current['me'] = analyser;
    } else if (!localStream && analysersRef.current['me']) {
        delete analysersRef.current['me'];
    }

    // Remote Streams Analysers
    Object.entries(roomPeers).forEach(([peerId, data]) => {
        if (data.stream && data.stream.getAudioTracks().length > 0 && !analysersRef.current[peerId]) {
             const source = ctx.createMediaStreamSource(data.stream);
             const analyser = ctx.createAnalyser();
             analyser.fftSize = 64;
             source.connect(analyser);
             analysersRef.current[peerId] = analyser;
        }
    });
    
    // Cleanup old peers
    Object.keys(analysersRef.current).forEach(peerId => {
        if (peerId !== 'me' && !roomPeers[peerId]) {
            delete analysersRef.current[peerId];
        }
    });

  }, [localStream, roomPeers]);
  const [customSounds, setCustomSounds] = useState(() => {
    try {
        const saved = localStorage.getItem('dss_custom_sounds');
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('dss_custom_sounds', JSON.stringify(customSounds));
  }, [customSounds]);

  const addSound = async (name, file) => {
    if (customSounds.length >= MAX_SOUNDS) {
        showError(`Maximum ${MAX_SOUNDS} sounds allowed.`);
        return false;
    }
    if (file.size > MAX_SOUND_SIZE_KB * 1024) {
        showError(`File too large. Max ${MAX_SOUND_SIZE_KB}KB.`);
        return false;
    }

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const newSound = {
                id: Date.now().toString(),
                name: name.trim() || 'Sound',
                src: e.target.result // Base64
            };
            setCustomSounds(prev => [...prev, newSound]);
            resolve(true);
        };
        reader.readAsDataURL(file);
    });
  };

  const removeSound = (id) => {
    setCustomSounds(prev => prev.filter(s => s.id !== id));
  };

  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  // Device selection state
  const [availableDevices, setAvailableDevices] = useState({ audioInputs: [], videoInputs: [], audioOutputs: [] });
  const [selectedMicId, setSelectedMicId] = useState('');
  const [selectedCameraId, setSelectedCameraId] = useState('');

  const playSound = (soundId) => {
    const sound = customSounds.find(s => s.id === soundId);
    if (!sound) return;

    // 1. Play locally
    const audio = new Audio(sound.src);
    audio.volume = 0.5;
    activeSoundsRef.current.push(audio);
    
    audio.onended = () => {
        activeSoundsRef.current = activeSoundsRef.current.filter(a => a !== audio);
    };
    
    audio.play().catch(e => console.error("Error playing sound:", e));

    // 2. Send to Peer (Embed the data so they don't need it locally)
    if (dataConnection && dataConnection.open) {
        console.log("Sending sound effect:", sound.name);
        dataConnection.send({ 
            type: 'SOUND_EFFECT', 
            payload: { src: sound.src, name: sound.name } 
        });
    } else {
        console.warn("Cannot send sound effect. Data connection missing or closed.");
    }
  };
  
  // Sync activeRoomRef for cleanup
  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const currentCallDocIdRef = useRef(null); // Firestore document ID for signaling
  const localStreamRef = useRef(null); // Ref to access stream in callbacks
  const activeCallRef = useRef(null); // Ref to valid active call
  const activeSoundsRef = useRef([]); // Track active sound effects for cleanup

  const stopAllSounds = () => {
    activeSoundsRef.current.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
    activeSoundsRef.current = [];
  };

  const handleRoomCallSafe = (call) => {
       call.on('stream', (remoteStream) => {
          console.log(`Mesh: Received stream from ${call.peer}`);
          // Don't play duplicate audio here. Use React render.
          setRoomPeers(prev => ({
              ...prev,
              [call.peer]: { call, stream: remoteStream }
          }));
      });
      
      call.on('close', () => {
          console.log(`Mesh: Peer ${call.peer} disconnected`);
          setRoomPeers(prev => {
              const newPeers = { ...prev };
              delete newPeers[call.peer]; 
              return newPeers;
          });
      });
      
      call.on('error', (e) => console.error("Mesh call error:", e));
  };
  
  const toggleDeafen = () => {
      setIsDeafened(prev => !prev);
      // NOTE: We don't need to stop streams, we just mute the audio players locally.
      // Ideally we also tell Firestore we are deafened.
      if (currentUser && activeRoom) {
          const { channelId, serverId } = activeRoom;
          const userRef = doc(db, 'servers', serverId, 'channels', channelId, 'connectedUsers', currentUser.uid);
          updateDoc(userRef, { isDeafened: !isDeafened }).catch(console.error);
      }
  };

  const stopRingRef = useRef(null); // Ref to hold the sound stop function

  // Update ref when state changes
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Sound Effect Logic
  useEffect(() => {
    // Stop any existing sound when status changes
    if (stopRingRef.current) {
        stopRingRef.current();
        stopRingRef.current = null;
    }
    stopRing(); // Double safety

    if (callStatus === 'incoming') {
        stopRingRef.current = playIncomingRing();
    } else if (callStatus === 'outgoing') {
        stopRingRef.current = playOutgoingRing();
    }
    
    return () => {
        if (stopRingRef.current) {
            stopRingRef.current();
        }
        stopRing();
    };
  }, [callStatus]);

  // 1. Initialize PeerJS on login
  useEffect(() => {
    if (!currentUser) return;

    // Create a new peer with a random ID
    const newPeer = new Peer();

    newPeer.on('open', (id) => {
      console.log('My Peer ID is:', id);
      setMyPeerId(id);
      setPeer(newPeer);
    });

    newPeer.on('call', (call) => {
      console.log('Receiving PeerJS call connection...');
      
      // CHECK IF VOICE ROOM CALL (Mesh)
      if (call.metadata && call.metadata.type === 'room_call') {
          console.log("Detected incoming ROOM call from:", call.peer);
          
          const stream = localStreamRef.current || (cameraStreamRef.current);
          if (stream) {
              call.answer(stream);
          } else {
              call.answer();
          }
          
          // Delegate to Room Logic
          // We need to ensure handleRoomCall is accessible or logic is duplicated here slightly safely
          // Since handleRoomCall is defined via const below, we can't call it if it's not hoisted?
          // Actually, we can move handleRoomCall definition up or use a ref?
          // OR, since this is an effect running after mount, handleRoomCall might be defined?
          // NO, const functions are not hoisted.
          
          // Let's implement the logic inline here properly to be safe, or direct call.
          // Better: Define handleRoomCall via useCallback/useRef or move it up?
          // Moving it up is cleaner but risky with file size.
          // We will duplicate the critical registration logic here for safety or use a shared handler ref.
          
          handleRoomCallSafe(call);
          return; 
      }

      // Handle Re-call / Upgrade (Direct Calls)
      if (activeCallRef.current && activeCallRef.current.peer === call.peer) {
          console.log("Replacing existing call (upgrade/renegotiation detected)");
          if (activeCallRef.current.removeAllListeners) {
              activeCallRef.current.removeAllListeners('close');
          }
          activeCallRef.current.close();
      }

      const stream = localStreamRef.current || (cameraStreamRef.current);
      if (stream) {
          console.log('Answering call with local stream');
          call.answer(stream); 
      } else {
          console.warn('No local stream found when answering! Answering audio-only or empty.');
          call.answer(); 
      }
      
      call.on('stream', (remoteStream) => {
        console.log('Received remote stream');
        setRemoteStream(remoteStream);
      });
      
      setActiveCall(call);
      setCallStatus('connected'); 
    });

    // Handle Metadata support for Room Calls vs Direct Calls
    // Note: PeerJS v1.x doesn't pass metadata in 'call' event easily without a wrapper or data connection.
    // So we will stick to a simpler strategy:
    // If we are in 'activeRoom' state, assume incoming calls are for the room UNLESS they match an explicit incomingCall signal.
    // ... For now, keeping the generic handler above.
    
    newPeer.on('error', (err) => {
        console.error('PeerJS Error:', err);
        if (err.type !== 'peer-unavailable') {
            // silent fail for minor network blips
        }
    });

    // Handle Incoming Data Connection (from Callee or Caller)
    newPeer.on('connection', (conn) => {
        console.log("Data connection received from peer:", conn.peer);
        
        conn.on('open', () => {
             console.log("Data connection open event fired.");
             setDataConnection(conn);
        });

        conn.on('data', (data) => {
            if (data && data.type === 'SOUND_EFFECT' && data.payload?.src) {
                console.log("Received sound effect:", data.payload.name);
                const audio = new Audio(data.payload.src);
                audio.volume = 0.5;
                
                activeSoundsRef.current.push(audio);
                audio.onended = () => {
                    activeSoundsRef.current = activeSoundsRef.current.filter(a => a !== audio);
                };

                audio.play().catch(e => console.error("Error playing remote sound:", e));
            }
        });
        
        conn.on('close', () => {
            console.log("Data connection closed.");
            setDataConnection(null);
        });
        
        conn.on('error', (err) => console.error("Data connection error:", err));

        // In case it's already open
        if (conn.open) {
             console.log("Data connection already open.");
             setDataConnection(conn);
        }
    });

    return () => {
      newPeer.destroy();
    };
  }, [currentUser]);

  // 2. Listen for Incoming Calls (Signaling via Firestore)
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'users', currentUser.uid, 'incomingCalls'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          // We have an incoming call!
          const callData = change.doc.data();
          setIncomingCall({ id: change.doc.id, ...callData });
          setCallStatus('incoming');
          // Play ringtone here if desired
        }
        if (change.type === 'removed') {
          // If the doc is removed and we haven't accepted it (still incoming)
          // or if we are just hanging around, clean up.
          // Note: If we accepted it, we handle cleanup via PeerJS close event or dedicated End Call button
          // checking if this specific call was the one we were looking at
          setIncomingCall(prev => {
              // CHANGE: Only end call if we are NOT connected. 
              // If we are connected, this 'removed' event is just the doc status changing to 'accepted' 
              // (dropping out of the 'status==pending' query).
              if (prev && prev.id === change.doc.id) {
                  setCallStatus(currentStatus => {
                      if (currentStatus !== 'connected') {
                          endCall(false); 
                      }
                      return currentStatus;
                  });
                  return null;
              }
              return prev;
          });
        }
      });
    });

    return () => unsubscribe();
  }, [currentUser]);

  // 3. Helper: Enumerate available media devices
  const refreshDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
      
      setAvailableDevices({ audioInputs, videoInputs, audioOutputs });
      
      // Set default devices if not already selected
      if (!selectedMicId && audioInputs.length > 0) {
        setSelectedMicId(audioInputs[0].deviceId);
      }
      if (!selectedCameraId && videoInputs.length > 0) {
        setSelectedCameraId(videoInputs[0].deviceId);
      }
      
      console.log('Devices enumerated:', { audioInputs: audioInputs.length, videoInputs: videoInputs.length });
      return { audioInputs, videoInputs, audioOutputs };
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
      return { audioInputs: [], videoInputs: [], audioOutputs: [] };
    }
  };

  // Initial device enumeration
  useEffect(() => {
    refreshDevices();
    
    // Listen for device changes (plugging in/out devices)
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
  }, []);

  // 4. Helper: Get Media Stream with enhanced audio quality and selected devices
  const getMediaStream = async (video = true) => {
    try {
      // Ensure devices are enumerated
      if (availableDevices.audioInputs.length === 0) {
        await refreshDevices();
      }
      
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        ...(selectedMicId && { deviceId: { exact: selectedMicId } })
      };
      
      const videoConstraints = video ? {
        width: 1280,
        height: 720,
        ...(selectedCameraId && { deviceId: { exact: selectedCameraId } })
      } : false;
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: audioConstraints
      });
      
      console.log('Media stream acquired with selected devices');
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('Failed to get local stream', err);
      showError('Could not access camera/microphone');
      return null;
    }
  };

  // 4. Start Call (Caller Side)
  const startCall = async (targetUser, type = 'video') => {
    if (!peer || !myPeerId) {
      showError('Connection not ready. Please wait a moment.');
      return;
    }

    setOutgoingCallUser(targetUser);
    setCallStatus('outgoing');

    const stream = await getMediaStream(type === 'video');
    if (!stream) {
      setCallStatus('idle');
      return;
    }
    
    if (type === 'voice') {
        setIsVideoOff(true);
    } else {
        setIsVideoOff(false);
    }

    try {
      // Use profile data as fallback if auth data is missing
      const callerName = currentUser.displayName || userProfile?.displayName || 'Unknown';
      // Check all possible photo properties (Auth uses photoURL, Firestore often uses photoUrl)
      const callerPhoto = currentUser.photoURL || userProfile?.photoURL || userProfile?.photoUrl || null;

      const callDoc = await addDoc(collection(db, 'users', targetUser.id, 'incomingCalls'), {
        callerId: currentUser.uid,
        callerName: callerName,
        callerPhotoUrl: callerPhoto,
        peerId: myPeerId,
        type: type,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      currentCallDocIdRef.current = callDoc.id;
      
      const unsub = onSnapshot(doc(db, 'users', targetUser.id, 'incomingCalls', callDoc.id), 
        (snapshot) => {
          const isMyCurrentCall = currentCallDocIdRef.current === callDoc.id;
          
          if (!snapshot.exists()) {
              if (isMyCurrentCall) { 
                  if (callStatus === 'outgoing') {
                     showError('Call ended or declined');
                     endCall(false); 
                  }
              }
              unsub();
          } else {
              const data = snapshot.data();
              if (data.status === 'accepted') {
                   if (isMyCurrentCall) {
                        setCallStatus('connected');
                   }
              } else if (data.status === 'rejected') {
                   // Status is stale in this closure, but ref is current.
                   // If this is the doc we are tracking, we should end it.
                   if (isMyCurrentCall) {
                        showError('Call declined');
                        // Caller is responsible for cleanup now
                        endCall(true); 
                   }
              }
          }
        }, 
        (error) => {
            console.warn("Call snapshot error:", error);
            const isMyCurrentCall = currentCallDocIdRef.current === callDoc.id;
            // Ref check is sufficient
            if (isMyCurrentCall) {
                 // Fallback for permission errors (old behavior)
                 showError('Call declined');
                 endCall(false);
            }
        }
      );

    } catch (err) {
      console.error('Signaling failed:', err);
      showError('Failed to direct call');
      endCall();
    }
  };

  // Monitor WebRTC Connection State (Heartbeat/Resilience)
  useEffect(() => {
    if (!activeCall || !activeCall.peerConnection) return;

    const handleConnectionStateChange = () => {
        const connectionState = activeCall.peerConnection.connectionState;
        const iceState = activeCall.peerConnection.iceConnectionState;
        
        console.log(`Connection State: ${connectionState}, ICE State: ${iceState}`);

        if (iceState === 'disconnected' || iceState === 'failed' || iceState === 'closed') {
            console.warn("Peer connection lost/failed. Ending call...");
            // Give a small grace period for 'disconnected' to potentially recover (e.g. erratic network)
            // But 'failed' is usually fatal.
            if (iceState === 'failed' || iceState === 'closed') {
                endCall();
            } else if (iceState === 'disconnected') {
                 // Optional: Wait 5s before ending? For now, let's keep it snappy if user wants immediate feedback.
                 // checking activeCallRef to ensure we don't kill a NEW call if this event fires late
                 if (activeCallRef.current === activeCall) {
                      // Attempt to reconnect or just end? PeerJS reconnect is tricky for calls.
                      // Let's explicitly check if we are still "connected" in logic
                      setTimeout(() => {
                          if (activeCallRef.current && activeCallRef.current.peerConnection.iceConnectionState === 'disconnected') {
                              console.log("Connection still disconnected after timeout. Ending.");
                              endCall();
                          }
                      }, 3000);
                 }
            }
        }
    };

    activeCall.peerConnection.addEventListener('iceconnectionstatechange', handleConnectionStateChange);
    // Also listen to connectionstatechange if available (newer browsers)
    activeCall.peerConnection.addEventListener('connectionstatechange', handleConnectionStateChange);

    return () => {
        if (activeCall && activeCall.peerConnection) {
            activeCall.peerConnection.removeEventListener('iceconnectionstatechange', handleConnectionStateChange);
            activeCall.peerConnection.removeEventListener('connectionstatechange', handleConnectionStateChange);
        }
    };
  }, [activeCall]);

  // 5. Answer Call (Callee Side)
  const answerCall = async () => {
    if (!incomingCall || !peer) return;

    setCallStatus('connected');
    
    // Get local stream
    const isVideo = incomingCall.type === 'video';
    const stream = await getMediaStream(isVideo);
    if (!stream) {
       console.error("Stream failed, rejecting call signal.");
       try {
           // Reject by updating status
           await updateDoc(doc(db, 'users', currentUser.uid, 'incomingCalls', incomingCall.id), {
               status: 'rejected'
           });
       } catch(e) {}
       
       endCall(false);
       return;
    }

    if (!isVideo) setIsVideoOff(true);
    // ... continue as before ...

    console.log('Connecting to peer:', incomingCall.peerId);
     
     // Check if peer is valid/connected
    if (!peer || peer.disconnected) {
        showError('Peer connection lost. Reconnecting...');
        peer?.reconnect();
        // Wait briefly for reconnection
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!peer || peer.disconnected) {
             showError('Could not establish P2P connection.');
             endCall();
             return;
        }
    }

    try {
        const call = peer.call(incomingCall.peerId, stream);
        
        if (!call) {
            showError('Call failed to initialize.');
            endCall();
            return;
        }

        call.on('stream', (remoteStream) => {
          setRemoteStream(remoteStream);
        });

        call.on('close', () => {
            endCall();
        });
        
        call.on('error', (e) => {
            console.error('Call error:', e);
            endCall();
        });

        setActiveCall(call);

        // Don't delete immediately. Update status to 'accepted'.
        // This lets the caller know we picked up so they can stop "ringing" UI
        // We will delete it when the call ends.
        try {
            await updateDoc(doc(db, 'users', currentUser.uid, 'incomingCalls', incomingCall.id), {
                status: 'accepted'
            });
        } catch (e) {
            console.error('Error updating signal doc', e);
        }

    } catch (err) {
        console.error('Error calling peer:', err);
        showError('Failed to connect to peer.');
        endCall();
    }
    
    // Establish Data Connection for Soundboard
    // As Callee, we know the Caller's peer ID from incomingCall.peerId
    try {
        console.log("Establishing data connection to caller:", incomingCall.peerId);
        const conn = peer.connect(incomingCall.peerId);
        
        conn.on('open', () => {
            console.log("Data connection opened (Callee side)!");
            setDataConnection(conn);
        });
        
        conn.on('data', (data) => {
             // Handle if Caller sends data back
             if (data && data.type === 'SOUND_EFFECT' && data.payload?.src) {
                const audio = new Audio(data.payload.src);
                audio.volume = 0.5;
                
                activeSoundsRef.current.push(audio);
                audio.onended = () => {
                    activeSoundsRef.current = activeSoundsRef.current.filter(a => a !== audio);
                };

                audio.play().catch(e => console.error(e));
             }
        });

        conn.on('close', () => setDataConnection(null));
        conn.on('error', (err) => console.error("Data connection error (Callee):", err));
        
    } catch (e) {
        console.error("Failed to establish data connection", e);
    }
  };

  // 6. End Call (Both Sides)
  const endCall = async (deleteSignalDoc = true) => {
    // 0. Stop screen share stream if active
    if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
    }
    cameraStreamRef.current = null;

    // 1. Close local stream - use REF to avoid stale closure issues
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
    }
    // Also check state as backup
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    localStreamRef.current = null;

    // 2. Close peer connection
    if (activeCall) {
      activeCall.close();
      setActiveCall(null);
    }

    // 3. Clean up remote
    setRemoteStream(null);
    setCallStatus('idle');
    setIncomingCall(null);
    setOutgoingCallUser(null);
    setIsMuted(false);
    setIsMuted(false);
    setIsVideoOff(false);
    if (dataConnection) {
        dataConnection.close();
        setDataConnection(null);
    }
    stopAllSounds(); // Stop any soundboard effects

    // 4. Cancel signaling if I was the caller and calling is pending
    if (currentCallDocIdRef.current && deleteSignalDoc && outgoingCallUser) {
        try {
            await deleteDoc(doc(db, 'users', outgoingCallUser.id, 'incomingCalls', currentCallDocIdRef.current));
        } catch (e) { /* ignore */ }
    }
    // 5. If I am receiving a call and I reject it
    if (incomingCall && deleteSignalDoc) {
         try {
             // If incoming (not connected yet), reject properly
             if (callStatus === 'incoming') {
                 await updateDoc(doc(db, 'users', currentUser.uid, 'incomingCalls', incomingCall.id), {
                    status: 'rejected'
                 });
             } else {
                 // If connected, we can delete to clean up
                 await deleteDoc(doc(db, 'users', currentUser.uid, 'incomingCalls', incomingCall.id));
             }
         } catch (e) { /* ignore */ }
    }

    currentCallDocIdRef.current = null;
  };
  
  // Toggles
  const toggleAudio = () => {
    setIsMuted(prev => {
        const newState = !prev;
        
        // Handle Legacy PeerJS Stream if active
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !newState; // Muted = enabled: false
            }
        }
        return newState;
    });
  };

  const toggleVideo = () => {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            setIsVideoOff(!videoTrack.enabled);
        }
    }
  };

  const screenStreamRef = useRef(null);
  const cameraStreamRef = useRef(null); // To store camera stream when screen sharing

  const toggleScreenShare = async (options = null) => {
    // If already screen sharing -> Stop it
    if (screenStreamRef.current) {
        await stopScreenShare();
        return;
    }

    // Start Screen Share
    try {
        console.log("Requesting display media...", options);
        
        let videoConstraints = {};
        
        // 1. Determine Constraints (Res/FPS)
        let width = options?.width || 1280;
        let height = options?.height || 720;
        let frameRate = options?.frameRate || 30;

        // If no options passed (fallback behavior), check capability
        if (!options) {
             const canHQ = hasCapability(userProfile, CAPABILITIES.HIGH_QUALITY);
             if (canHQ) { width = 1920; height = 1080; frameRate = 60; }
        }

        // 2. Capture Strategy (Electron vs Web)
        let displayStream;
        
        if (options?.sourceId && window.require) {
            // ELECTRON STRATEGY: getUserMedia with sourceId
            console.log("Using Electron getUserMedia with sourceId:", options.sourceId);
            
            try {
                displayStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        mandatory: {
                            chromeMediaSource: 'desktop'
                        }
                    },
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: options.sourceId,
                            maxWidth: width,
                            maxHeight: height,
                            maxFrameRate: frameRate
                        }
                    }
                });
            } catch (e) {
                console.error("Electron getUserMedia failed:", e);
                throw e;
            }
        } else {
            // WEB STRATEGY: getDisplayMedia
            // Apply standard constraints
            const constraints = {
                 video: { 
                     width: { ideal: width },
                     height: { ideal: height },
                     frameRate: { ideal: frameRate },
                     displaySurface: options?.displaySurface // Hint browser preference
                 },
                 audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false // usually bad for system audio music
                 } 
            };
            
            console.log("Using Web getDisplayMedia with constraints:", constraints);
            displayStream = await navigator.mediaDevices.getDisplayMedia(constraints);
        }


        const screenVideoTrack = displayStream.getVideoTracks()[0];
        setIsVideoOff(false); 
        console.log("Display media obtained:", screenVideoTrack.label);

        // 3. Audio Mixing (System Audio + Microphone)
        // If we got system audio track, we need to mix it with our existing microphone stream
        const screenAudioTrack = displayStream.getAudioTracks()[0];
        let mixedAudioTrack = null;

        if (screenAudioTrack) {
            console.log("System audio captured! Mixing with microphone...");
            // We need our current mic stream. 
            // If localStream has one, grab it. OR use availableDevices mic.
            let micStream = localStream; 
            
            // If localStream is missing or has no audio (muted?), we might need to get it again?
            // Usually localStream always has our mic if we are in a call.
            // But if we are muted, the track is enabled=false but exists.
            
            if (!micStream && availableDevices.audioInputs.length > 0) {
                 // Try to get mic just for mixing purposes
                 try {
                     micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                 } catch(e) { console.warn("Failed to get mic for mixing"); }
            }

            if (micStream && micStream.getAudioTracks().length > 0) {
                const micTrack = micStream.getAudioTracks()[0];
                
                // Web Audio API Mixing
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const dest = audioCtx.createMediaStreamDestination();
                
                const micSource = audioCtx.createMediaStreamSource(new MediaStream([micTrack]));
                const sysSource = audioCtx.createMediaStreamSource(new MediaStream([screenAudioTrack]));
                
                // Gain Nodes for balance (optional, currently 1:1)
                const micGain = audioCtx.createGain();
                const sysGain = audioCtx.createGain();
                micGain.gain.value = 1.0; 
                sysGain.gain.value = 1.0; 

                micSource.connect(micGain).connect(dest);
                sysSource.connect(sysGain).connect(dest);
                
                mixedAudioTrack = dest.stream.getAudioTracks()[0];
                
                // Keep context reference to close later? 
                // We'll trust browser garbage collection or simple close on stop
                screenStreamRef.currentAudioContext = audioCtx;
            } else {
                // No mic, just send system audio
                mixedAudioTrack = screenAudioTrack;
            }
        }

        // 4. Update Local Stream
        // Store current camera stream
        if (localStream && !cameraStreamRef.current) {
            cameraStreamRef.current = localStream; 
        }

        screenVideoTrack.onended = () => {
            console.log("Screen track ended by user/browser UI");
            stopScreenShare();
        };

        screenStreamRef.current = displayStream;

        // Construct new stream for local view/sending
        // If mixed audio exists, use it. Else fall back to existing mic tracks from localStream (if any)
        const audioTracksToUse = mixedAudioTrack ? [mixedAudioTrack] : (localStream ? localStream.getAudioTracks() : []);
        
        const newLocalStream = new MediaStream([
            screenVideoTrack, 
            ...audioTracksToUse
        ]);
        setLocalStream(newLocalStream);

        // 5. Update Peer Connection (Send to Remote)
        if (activeCall && activeCall.peerConnection) {
            const senders = activeCall.peerConnection.getSenders();
            
            // Replace Video
            const videoSender = senders.find(s => s.track && s.track.kind === 'video');
            if (videoSender) {
                await videoSender.replaceTrack(screenVideoTrack);
            } else {
                // Add track if missing (renegotiation needed usually, handled via Re-Call logic below if complex)
            }

            // Replace Audio (if we have a new mixed track)
            if (mixedAudioTrack) {
                const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
                if (audioSender) {
                     console.log("Replacing audio sender with mixed track...");
                     await audioSender.replaceTrack(mixedAudioTrack);
                }
            }
            
            if (!videoSender) {
                 // Fallback for audio-only upgrading to video
                 console.log("Audio-only -> Screen Share upgrade. Renegotiating...");
                 // (Existing renegotiation logic ...)
                 const remotePeerId = activeCall.peer;
                 if (peer && remotePeerId) {
                     activeCall.removeAllListeners('close'); 
                     const newCall = peer.call(remotePeerId, newLocalStream);
                     
                     newCall.on('stream', (remoteStream) => setRemoteStream(remoteStream));
                     newCall.on('close', () => endCall());
                     newCall.on('error', () => endCall());
                     setActiveCall(newCall);
                 }
            }
        }
    } catch (err) {
        console.error("Error starting screen share:", err);
        showError("Failed to start screen share");
    }
  };

  const stopScreenShare = async () => {
    if (!screenStreamRef.current) return;
    console.log("Stopping screen share...");

    // 0. Clean up Audio Context if exists
    if (screenStreamRef.currentAudioContext) {
        screenStreamRef.currentAudioContext.close();
        screenStreamRef.currentAudioContext = null;
    }

    // 1. Stop screen tracks
    screenStreamRef.current.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;

    // 2. Revert to Camera or Audio-only
    if (cameraStreamRef.current) {
         console.log("Reverting to previous stream state...");
         
         const cameraTrack = cameraStreamRef.current.getVideoTracks()[0];
         const originalAudioTracks = cameraStreamRef.current.getAudioTracks();

         if (activeCall && activeCall.peerConnection) {
             const senders = activeCall.peerConnection.getSenders();
             
             // Revert Video
             const videoSender = senders.find(s => s.track && s.track.kind === 'video');
             if (cameraTrack && videoSender) {
                  try { await videoSender.replaceTrack(cameraTrack); } catch(e) {}
             } else if (videoSender && !cameraTrack) {
                  // If we don't have video anymore, remove sender (or just leave it mute)
                  // activeCall.peerConnection.removeTrack(videoSender); 
                  // Removing often complicated, just send black/mute?
             }

             // Revert Audio (Important!)
             // We must replace the 'mixed' track with the original raw mic track
             const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
             if (audioSender && originalAudioTracks.length > 0) {
                  console.log("Reverting audio sender to original mic...");
                  await audioSender.replaceTrack(originalAudioTracks[0]);
             }
         }

          // Update Local UI
         setLocalStream(cameraStreamRef.current);
         cameraStreamRef.current = null;
    } else {
        console.log("No stored camera stream, requesting new user media...");
        // If no camera stream was stored, try to get camera
        try {
            const stream = await getMediaStream(true);
            if (stream && activeCall && activeCall.peerConnection) {
                const videoTrack = stream.getVideoTracks()[0];
                const sender = activeCall.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                     await sender.replaceTrack(videoTrack);
                }
            }
        } catch(e) {
             console.error("Failed to restore camera:", e);
        }
    }
  };

  // ------------------------------------------------------------------
  // VOICE ROOM LOGIC (Mesh Topology)
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // VOICE ROOM LOGIC (LiveKit Migration)
  // ------------------------------------------------------------------

  const joinVoiceChannel = async (channelId, serverId) => {
    if (!currentUser) return;
    
    // 1. Leave current room if any
    if (activeRoom) {
       await leaveVoiceChannel();
    }

    console.log(`Joining voice channel (LiveKit): ${channelId}`);
    setActiveRoom({ channelId, serverId });

    // 2. Add Self to Firestore `connectedUsers` for UI presence
    // We still use Firestore to show "Who is in the channel" in the sidebar list.
    const userRef = doc(db, 'servers', serverId, 'channels', channelId, 'connectedUsers', currentUser.uid);
    await updateDoc(userRef, {
        displayName: userProfile?.displayName || currentUser.email,
        photoUrl: userProfile?.photoUrl || '',
        joinedAt: serverTimestamp(),
        isMuted: isMuted,
        isDeafened: false
    }).catch(async (err) => {
        if (err.code === 'not-found') {
             await setDoc(userRef, {
                displayName: userProfile?.displayName || currentUser.uid,
                photoUrl: userProfile?.photoUrl || '',
                joinedAt: serverTimestamp(),
                lastSeen: serverTimestamp(), // Init heartbeat
                isMuted: isMuted,
                isDeafened: false
            }, { merge: true });
        } else {
            console.error("Error joining voice channel presence:", err);
        }
    });
  };

  // Heartbeat Mechanism
  useEffect(() => {
      if (!activeRoom || !currentUser) return;
      const { channelId, serverId } = activeRoom;
      const userRef = doc(db, 'servers', serverId, 'channels', channelId, 'connectedUsers', currentUser.uid);

      const interval = setInterval(() => {
          updateDoc(userRef, { lastSeen: serverTimestamp() })
            .catch(e => {
                if (e.code === 'not-found') {
                    // Re-join if doc disappeared
                    joinVoiceChannel(channelId, serverId);
                } else {
                    console.error("Heartbeat failed:", e);
                }
            });
      }, 10000); // 10 seconds frequency for faster updates

      return () => clearInterval(interval);
  }, [activeRoom, currentUser]);

  const leaveVoiceChannel = async () => {
      if (!activeRoom) return;
      const { channelId, serverId } = activeRoom;
      
      // LiveKit component will unmount and handle disconnection automatically
      // We just need to clear Presence and State.

      if (currentUser) {
          try {
             await deleteDoc(doc(db, 'servers', serverId, 'channels', channelId, 'connectedUsers', currentUser.uid));
          } catch(e) { console.error("Error removing from channel:", e); }
      }
      
      setActiveRoom(null);
  };



  // Handle Window Close / Refresh Cleanup
  useEffect(() => {
      const handleBeforeUnload = async (e) => {
          if (activeRoomRef.current && currentUser) {
             // Attempt to remove user from channel synchronously if possible, or trigger async
             // Firestore SDK might not complete in time, but we try.
             // Ideally we use a cloud function or presence system for 100% reliability,
             // but this catches most cases.
             const { channelId, serverId } = activeRoomRef.current;
             // We can't await here reliably, but we fire the promise.
             deleteDoc(doc(db, 'servers', serverId, 'channels', channelId, 'connectedUsers', currentUser.uid));
          }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentUser]);

  const value = {
    startCall,
    answerCall,
    endCall,
    toggleAudio,
    toggleVideo,
    callStatus,
    incomingCall,
    outgoingCallUser,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    activeCall,
    isScreenSharing: !!screenStreamRef.current,
    toggleScreenShare,
    availableDevices,
    selectedMicId,
    selectedCameraId,
    setSelectedMicId,
    setSelectedCameraId,
    playSound,
    customSounds,
    addSound,
    removeSound,
    // Voice Room Exports
    joinVoiceChannel,
    leaveVoiceChannel,
    activeRoom,
    roomPeers,
    isDeafened,
    toggleDeafen,
    talkingPeers,
    peerVolumes,
    setPeerVolume,
  };

  return (
    <CallContext.Provider value={value}>
        {children}
        {/* Room Audio Elements */}
        {/* Only render/play if NOT deafened */}
        {!isDeafened && Object.entries(roomPeers).map(([peerId, data]) => (
          <audio 
             key={peerId} 
             ref={el => { 
                 if(el) {
                     el.srcObject = data.stream;
                     el.volume = peerVolumes[peerId] ?? 1; // Default to 100%
                 } 
             }} 
             autoPlay 
             playsInline 
             controls={false}
          />
        ))}
    </CallContext.Provider>
  );
};

