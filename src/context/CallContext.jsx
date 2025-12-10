import { createContext, useContext, useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { db } from '../services/firebase';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { playIncomingRing, playOutgoingRing, stopRing } from '../utils/callSounds';

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
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const currentCallDocIdRef = useRef(null); // Firestore document ID for signaling
  const localStreamRef = useRef(null); // Ref to access stream in callbacks

  const stopRingRef = useRef(null); // Ref to hold the sound stop function

  // Update ref when state changes
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

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

    // IMPORTANT: This is for the "Initiator" of the Firestore signal
    // (User A called User B. User B accepted and is now "dialing back" via PeerJS)
    newPeer.on('call', (call) => {
      console.log('Receiving PeerJS call connection...');
      
      // CRITICAL FIX: We MUST answer the call and provide our stream
      // Using ref because direct state might be stale in this closure
      const stream = localStreamRef.current;
      
      if (stream) {
          console.log('Answering call with local stream');
          call.answer(stream); // Send our A/V back
      } else {
          console.warn('No local stream found when answering! Answering audio-only or empty.');
          call.answer(); 
      }
      
      call.on('stream', (remoteStream) => {
        console.log('Received remote stream');
        setRemoteStream(remoteStream);
      });
      
      call.on('close', () => {
         endCall();
      });

      setActiveCall(call);
      setCallStatus('connected'); // Ensure status is updated
    });
    
    newPeer.on('error', (err) => {
        console.error('PeerJS Error:', err);
        if (err.type !== 'peer-unavailable') {
            // silent fail for minor network blips
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

  // 3. Helper: Get Media Stream
  const getMediaStream = async (video = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 1280, height: 720 } : false,
        audio: true
      });
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
  };

  // 6. End Call (Both Sides)
  const endCall = async (deleteSignalDoc = true) => {
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
    setIsVideoOff(false);

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
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            setIsMuted(!audioTrack.enabled);
        }
    }
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
    activeCall
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};
