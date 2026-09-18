import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { socket } from '../socket';
import { VoiceParticipant, VoiceSignalData } from '../types';

interface VoiceChatContextType {
  isVoiceJoined: boolean;
  isConnecting: boolean;
  hasMic: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  needsAudioUnlock: boolean;
  permissionState: 'idle' | 'prompt' | 'granted' | 'denied' | 'unsupported';
  errorMessage: string | null;
  participants: VoiceParticipant[];
  speakingMap: Record<string, boolean>; // playerId -> isSpeaking
  volumeLevel: number; // 0..100 (my mic level)
  peerVolumes: Record<string, number>; // socketId -> volume 0..100
  joinVoice: () => Promise<boolean>;
  leaveVoice: () => void;
  toggleMute: () => Promise<void>;
  toggleDeafen: () => void;
  setPeerVolume: (socketId: string, volume: number) => void;
  unlockAudio: () => void;
  clearError: () => void;
}

const VoiceChatContext = createContext<VoiceChatContextType | null>(null);

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
  iceCandidatePoolSize: 2,
};

interface VoiceChatProviderProps {
  children: ReactNode;
  roomCode: string | null;
  playerId: string;
  playerName: string;
  playerAvatar: string;
}

export const VoiceChatProvider: React.FC<VoiceChatProviderProps> = ({
  children,
  roomCode,
  playerId,
  playerName,
  playerAvatar,
}) => {
  const [isVoiceJoined, setIsVoiceJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasMic, setHasMic] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Mặc định tắt mic khi mới vào
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [permissionState, setPermissionState] = useState<
    'idle' | 'prompt' | 'granted' | 'denied' | 'unsupported'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [speakingMap, setSpeakingMap] = useState<Record<string, boolean>>({});
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});

  // Refs for WebRTC & Audio
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const queuedCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isMutedRef = useRef(isMuted);
  const isDeafenedRef = useRef(isDeafened);
  const isVoiceJoinedRef = useRef(isVoiceJoined);
  const hasMicRef = useRef(hasMic);
  const lastSpeakingSentRef = useRef<boolean>(false);
  const lastSpeakingTimeRef = useRef<number>(0);
  const roomCodeRef = useRef(roomCode);
  const peerVolumesRef = useRef(peerVolumes);

  useEffect(() => {
    peerVolumesRef.current = peerVolumes;
  }, [peerVolumes]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    hasMicRef.current = hasMic;
  }, [hasMic]);

  useEffect(() => {
    isDeafenedRef.current = isDeafened;
    // Apply deafen state to all remote audio elements
    audioElementsRef.current.forEach((audio) => {
      audio.muted = isDeafened;
    });
  }, [isDeafened]);

  useEffect(() => {
    isVoiceJoinedRef.current = isVoiceJoined;
  }, [isVoiceJoined]);

  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  // Unlock audio context and audio elements on user interaction (resolves autoplay restrictions)
  const unlockAudio = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }

    audioElementsRef.current.forEach((audio) => {
      if (!isDeafenedRef.current) {
        audio.muted = false;
        audio.play().catch((err) => {
          console.warn('[VoiceChat] Remote audio play blocked on unlock:', err);
        });
      }
    });

    setNeedsAudioUnlock(false);
  }, []);

  // Global event listener to automatically unlock audio as soon as user clicks or taps anywhere
  useEffect(() => {
    const handleGlobalInteraction = () => {
      unlockAudio();
    };

    window.addEventListener('click', handleGlobalInteraction, { passive: true });
    window.addEventListener('touchstart', handleGlobalInteraction, { passive: true });
    window.addEventListener('keydown', handleGlobalInteraction, { passive: true });

    return () => {
      window.removeEventListener('click', handleGlobalInteraction);
      window.removeEventListener('touchstart', handleGlobalInteraction);
      window.removeEventListener('keydown', handleGlobalInteraction);
    };
  }, [unlockAudio]);

  // Clean up WebRTC peer connections and media tracks
  const cleanupVoiceSession = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      localStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.close();
      } catch (e) {}
    });
    peerConnectionsRef.current.clear();

    audioElementsRef.current.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      if (audio.parentNode) {
        audio.parentNode.removeChild(audio);
      }
    });
    audioElementsRef.current.clear();
    queuedCandidatesRef.current.clear();

    setIsVoiceJoined(false);
    setIsConnecting(false);
    setHasMic(false);
    setIsMuted(true);
    setIsSpeaking(false);
    setVolumeLevel(0);
    setSpeakingMap({});
    setParticipants([]);
    lastSpeakingSentRef.current = false;
  }, []);

  // Leave Voice Chat explicitly
  const leaveVoice = useCallback(() => {
    const currentCode = roomCodeRef.current;
    if (currentCode) {
      socket.emit('VOICE_LEAVE', { roomCode: currentCode });
    }
    cleanupVoiceSession();
  }, [cleanupVoiceSession]);

  // Setup Web Audio API analyser to detect speaking loudness and visualizer
  const setupAudioAnalyser = useCallback(
    (stream: MediaStream) => {
      try {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;

        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new AudioCtx();
        }

        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const checkVolume = () => {
          if (!analyserRef.current || isMutedRef.current || isDeafenedRef.current) {
            setVolumeLevel(0);
            if (lastSpeakingSentRef.current) {
              lastSpeakingSentRef.current = false;
              setIsSpeaking(false);
              const code = roomCodeRef.current;
              if (code && isVoiceJoinedRef.current) {
                socket.emit('VOICE_STATUS_UPDATE', {
                  roomCode: code,
                  isSpeaking: false,
                });
              }
            }
            animFrameRef.current = requestAnimationFrame(checkVolume);
            return;
          }

          analyserRef.current.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const normalized = Math.min(100, Math.round((average / 128) * 100));
          setVolumeLevel(normalized);

          // Threshold for speaking detection
          const now = Date.now();
          const speakingThreshold = 14;
          const currentlySpeaking = normalized > speakingThreshold;

          if (currentlySpeaking) {
            lastSpeakingTimeRef.current = now;
          }

          // Hang time of 350ms so voice indicator doesn't jitter
          const isActuallySpeaking = now - lastSpeakingTimeRef.current < 350;

          if (isActuallySpeaking !== lastSpeakingSentRef.current) {
            lastSpeakingSentRef.current = isActuallySpeaking;
            setIsSpeaking(isActuallySpeaking);

            const code = roomCodeRef.current;
            if (code && isVoiceJoinedRef.current) {
              socket.emit('VOICE_STATUS_UPDATE', {
                roomCode: code,
                isSpeaking: isActuallySpeaking,
              });
            }

            setSpeakingMap((prev) => ({
              ...prev,
              [playerId]: isActuallySpeaking,
            }));
          }

          animFrameRef.current = requestAnimationFrame(checkVolume);
        };

        animFrameRef.current = requestAnimationFrame(checkVolume);
      } catch (e) {
        console.warn('AudioAnalyser setup skipped:', e);
      }
    },
    [playerId]
  );

  // Create WebRTC Peer Connection to a target remote socket
  // Supports both listen-only and sending audio
  const createPeerConnection = useCallback(
    (targetSocketId: string, isInitiator: boolean) => {
      // Return existing PC if already present
      if (peerConnectionsRef.current.has(targetSocketId)) {
        const existingPc = peerConnectionsRef.current.get(targetSocketId)!;
        if (existingPc.connectionState !== 'closed' && existingPc.connectionState !== 'failed') {
          return existingPc;
        }
      }

      console.log(`[VoiceChat] Creating PeerConnection to ${targetSocketId}, isInitiator: ${isInitiator}`);
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionsRef.current.set(targetSocketId, pc);

      // If we have a local audio track, add it.
      // Otherwise, add a recvonly transceiver so we can always receive audio from others!
      if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          console.log('[VoiceChat] Attaching local audio track to PC for', targetSocketId);
          pc.addTrack(track, localStreamRef.current!);
        });
      } else {
        try {
          console.log('[VoiceChat] Adding recvonly audio transceiver for', targetSocketId);
          pc.addTransceiver('audio', { direction: 'recvonly' });
        } catch (err) {
          console.warn('[VoiceChat] Could not add recvonly transceiver:', err);
        }
      }

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && roomCodeRef.current) {
          socket.emit('VOICE_SIGNAL', {
            roomCode: roomCodeRef.current,
            targetSocketId,
            signal: {
              type: 'candidate',
              candidate: event.candidate.toJSON(),
            },
          });
        }
      };

      // Handle incoming remote audio track
      pc.ontrack = (event) => {
        console.log('[VoiceChat] Remote track received from', targetSocketId, 'kind:', event.track.kind);
        let audio = audioElementsRef.current.get(targetSocketId);
        if (!audio) {
          audio = document.createElement('audio');
          audio.autoplay = true;
          (audio as any).playsInline = true;
          audio.setAttribute('playsinline', 'true');
          audio.setAttribute('autoplay', 'true');

          // Append to a dedicated container in the DOM so browsers (Safari/Chrome) never suspend or garbage collect it
          let container = document.getElementById('webrtc-remote-audio-container');
          if (!container) {
            container = document.createElement('div');
            container.id = 'webrtc-remote-audio-container';
            container.style.position = 'fixed';
            container.style.pointerEvents = 'none';
            container.style.opacity = '0';
            container.style.zIndex = '-9999';
            document.body.appendChild(container);
          }
          container.appendChild(audio);
          audioElementsRef.current.set(targetSocketId, audio);
        }

        // Construct valid MediaStream even if event.streams[0] is empty
        const stream = (event.streams && event.streams[0]) || new MediaStream([event.track]);
        audio.srcObject = stream;
        audio.muted = isDeafenedRef.current;
        const volume = peerVolumesRef.current[targetSocketId] ?? 1;
        audio.volume = volume;

        // When remote track un-mutes (RTP packet arrives), guarantee playback starts
        event.track.onunmute = () => {
          console.log('[VoiceChat] Remote track unmuted, playing audio for', targetSocketId);
          audio?.play().catch((err) => {
            console.warn('[VoiceChat] Autoplay blocked on track unmute:', err);
            setNeedsAudioUnlock(true);
          });
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('[VoiceChat] Audio autoplay blocked ontrack:', err);
            setNeedsAudioUnlock(true);
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[VoiceChat] Peer ${targetSocketId} connectionState:`, pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          peerConnectionsRef.current.delete(targetSocketId);
          const audio = audioElementsRef.current.get(targetSocketId);
          if (audio) {
            audio.pause();
            audio.srcObject = null;
            if (audio.parentNode) {
              audio.parentNode.removeChild(audio);
            }
            audioElementsRef.current.delete(targetSocketId);
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`[VoiceChat] Peer ${targetSocketId} iceConnectionState:`, pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed') {
          try {
            pc.restartIce();
          } catch (e) {}
        }
      };

      if (isInitiator) {
        pc.createOffer({ offerToReceiveAudio: true })
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (roomCodeRef.current && pc.localDescription) {
              console.log('[VoiceChat] Dispatching offer to', targetSocketId);
              socket.emit('VOICE_SIGNAL', {
                roomCode: roomCodeRef.current,
                targetSocketId,
                signal: {
                  type: 'offer',
                  sdp: pc.localDescription,
                },
              });
            }
          })
          .catch((err) => console.error('[VoiceChat] Error creating offer:', err));
      }

      return pc;
    },
    []
  );

  // Handle incoming signaling (Offer, Answer, ICE candidate)
  useEffect(() => {
    const handleVoiceSignal = async (data: {
      senderSocketId: string;
      signal: VoiceSignalData;
      roomCode: string;
    }) => {
      if (!isVoiceJoinedRef.current) return;
      const { senderSocketId, signal } = data;

      try {
        if (signal.type === 'offer') {
          let pc = peerConnectionsRef.current.get(senderSocketId);
          // Polite peer pattern: socket with lexicographically smaller id is polite
          const isPolite = socket.id ? socket.id.localeCompare(senderSocketId) > 0 : true;

          if (!pc) {
            pc = createPeerConnection(senderSocketId, false);
          }

          // Handle offer collision (Glare resolution)
          const offerCollision = pc.signalingState !== 'stable';
          if (offerCollision) {
            if (!isPolite) {
              console.warn('[VoiceChat] Impolite peer ignoring colliding offer from', senderSocketId);
              return;
            }
            console.log('[VoiceChat] Polite peer rolling back local offer to accept remote offer from', senderSocketId);
            await pc.setLocalDescription({ type: 'rollback' });
          }

          // 1. Set remote description FIRST
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // 2. Attach local track if we have one
          if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
            const track = localStreamRef.current.getAudioTracks()[0];
            const transceivers = pc.getTransceivers();
            const audioTransceiver = transceivers.find(
              (t) => t.receiver.track.kind === 'audio' || t.sender.track?.kind === 'audio'
            );
            if (audioTransceiver) {
              if (audioTransceiver.sender.track !== track) {
                await audioTransceiver.sender.replaceTrack(track);
              }
              if (audioTransceiver.direction === 'recvonly') {
                audioTransceiver.direction = 'sendrecv';
              }
            } else {
              pc.addTrack(track, localStreamRef.current);
            }
          }

          // 3. Process any queued candidates
          const queued = queuedCandidatesRef.current.get(senderSocketId) || [];
          for (const cand of queued) {
            try {
              await pc.addIceCandidate(cand);
            } catch (candErr) {
              console.warn('[VoiceChat] Queued candidate add error:', candErr);
            }
          }
          queuedCandidatesRef.current.delete(senderSocketId);

          // 4. Create answer and reply
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          if (roomCodeRef.current) {
            console.log('[VoiceChat] Sending answer to', senderSocketId);
            socket.emit('VOICE_SIGNAL', {
              roomCode: roomCodeRef.current,
              targetSocketId: senderSocketId,
              signal: {
                type: 'answer',
                sdp: answer,
              },
            });
          }
        } else if (signal.type === 'answer') {
          const pc = peerConnectionsRef.current.get(senderSocketId);
          if (pc && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            // Process queued candidates
            const queued = queuedCandidatesRef.current.get(senderSocketId) || [];
            for (const cand of queued) {
              try {
                await pc.addIceCandidate(cand);
              } catch (candErr) {
                console.warn('[VoiceChat] Queued candidate on answer error:', candErr);
              }
            }
            queuedCandidatesRef.current.delete(senderSocketId);
          }
        } else if (signal.type === 'candidate' && signal.candidate) {
          const pc = peerConnectionsRef.current.get(senderSocketId);
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(signal.candidate);
            } catch (candErr) {
              console.warn('[VoiceChat] Add ICE candidate error:', candErr);
            }
          } else {
            const list = queuedCandidatesRef.current.get(senderSocketId) || [];
            list.push(signal.candidate);
            queuedCandidatesRef.current.set(senderSocketId, list);
          }
        }
      } catch (err) {
        console.error('[VoiceChat] Signaling processing error:', err);
      }
    };

    const handleUserJoined = (participant: VoiceParticipant) => {
      setParticipants((prev) => {
        if (prev.some((p) => p.socketId === participant.socketId)) {
          return prev.map((p) => (p.socketId === participant.socketId ? participant : p));
        }
        return [...prev, participant];
      });

      // Existing peers DO NOT initiate connection with new joiner.
      // The new joiner will initiate the offer to existing peers in joinVoiceChannel,
      // which completely avoids offer collision/glare!
    };

    const handleUserLeft = (data: { socketId: string; playerId: string }) => {
      setParticipants((prev) => prev.filter((p) => p.socketId !== data.socketId));
      setSpeakingMap((prev) => {
        const next = { ...prev };
        delete next[data.playerId];
        return next;
      });

      const pc = peerConnectionsRef.current.get(data.socketId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(data.socketId);
      }
      const audio = audioElementsRef.current.get(data.socketId);
      if (audio) {
        audio.pause();
        audio.srcObject = null;
        audioElementsRef.current.delete(data.socketId);
      }
    };

    const handleStatusUpdate = (data: {
      socketId: string;
      playerId: string;
      isMuted: boolean;
      isSpeaking: boolean;
      hasMic?: boolean;
    }) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.socketId === data.socketId
            ? {
                ...p,
                isMuted: data.isMuted,
                isSpeaking: data.isSpeaking,
                hasMic: typeof data.hasMic === 'boolean' ? data.hasMic : p.hasMic,
              }
            : p
        )
      );
      setSpeakingMap((prev) => ({
        ...prev,
        [data.playerId]: data.isSpeaking,
      }));
    };

    socket.on('VOICE_SIGNAL', handleVoiceSignal);
    socket.on('VOICE_USER_JOINED', handleUserJoined);
    socket.on('VOICE_USER_LEFT', handleUserLeft);
    socket.on('VOICE_STATUS_UPDATE', handleStatusUpdate);

    return () => {
      socket.off('VOICE_SIGNAL', handleVoiceSignal);
      socket.off('VOICE_USER_JOINED', handleUserJoined);
      socket.off('VOICE_USER_LEFT', handleUserLeft);
      socket.off('VOICE_STATUS_UPDATE', handleStatusUpdate);
    };
  }, [createPeerConnection]);

  // Core join voice function (Mặc định vào ở chế độ NGHE - không đòi hỏi micro)
  const joinVoiceChannel = useCallback(
    async (requestMicInitially: boolean = false): Promise<boolean> => {
      const code = roomCodeRef.current;
      if (!code) {
        return false;
      }

      setIsConnecting(true);
      setErrorMessage(null);

      let micStream: MediaStream | null = null;
      let micAvailable = false;

      if (requestMicInitially && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
          localStreamRef.current = micStream;
          micAvailable = true;
          setHasMic(true);
          setIsMuted(false);
          setPermissionState('granted');
          setupAudioAnalyser(micStream);
        } catch (err: any) {
          console.warn('Microphone not acquired on initial join, falling back to listen-only mode:', err);
          setHasMic(false);
          setIsMuted(true);
          if (err.name === 'NotAllowedError') {
            setPermissionState('denied');
          }
        }
      }

      return new Promise<boolean>((resolve) => {
        socket.emit(
          'VOICE_JOIN',
          {
            roomCode: code,
            playerId,
            playerName,
            playerAvatar,
            isMuted: !micAvailable,
            hasMic: micAvailable,
          },
          (res: { success: boolean; participants?: VoiceParticipant[]; message?: string }) => {
            setIsConnecting(false);
            if (!res.success) {
              setErrorMessage(res.message || 'Không thể tham gia phòng voice');
              cleanupVoiceSession();
              resolve(false);
              return;
            }

            setIsVoiceJoined(true);
            const allPeers = res.participants || [];
            setParticipants(allPeers);

            // As the new joiner, initiate connections to all existing participants
            allPeers.forEach((peer) => {
              if (peer.socketId !== socket.id) {
                createPeerConnection(peer.socketId, true);
              }
            });

            resolve(true);
          }
        );
      });
    },
    [cleanupVoiceSession, createPeerConnection, playerAvatar, playerId, playerName, setupAudioAnalyser]
  );

  // Auto-join voice in LISTEN-ONLY mode whenever entering a room
  // "Quyền nghe là quyền cơ bản của mọi người trong phòng"
  useEffect(() => {
    if (roomCode && playerId) {
      joinVoiceChannel(false);
    } else {
      cleanupVoiceSession();
    }
  }, [roomCode, playerId, joinVoiceChannel, cleanupVoiceSession]);

  // Public joinVoice function (if user manually clicks to reconnect)
  const joinVoice = useCallback(async (): Promise<boolean> => {
    return joinVoiceChannel(false);
  }, [joinVoiceChannel]);

  // Toggle Microphone (Unmute / Mute / Request mic)
  // Cho phép người dùng bật mic khi muốn nói, hoặc tắt mic khi muốn giữ im lặng
  const toggleMute = useCallback(async () => {
    const currentMuted = isMutedRef.current;
    const currentHasMic = hasMicRef.current;

    // Trường hợp 1: Đang BẬT mic -> Muốn TẮT mic (Mute)
    if (!currentMuted) {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      setIsMuted(true);
      isMutedRef.current = true;
      setIsSpeaking(false);

      const code = roomCodeRef.current;
      if (code && isVoiceJoinedRef.current) {
        socket.emit('VOICE_STATUS_UPDATE', {
          roomCode: code,
          isMuted: true,
          isSpeaking: false,
        });
      }
      return;
    }

    // Trường hợp 2: Đang TẮT mic -> Muốn BẬT mic (Unmute)
    // Nếu đã có localStream sẵn rồi
    if (currentHasMic && localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      setIsMuted(false);
      isMutedRef.current = false;

      const code = roomCodeRef.current;
      if (code && isVoiceJoinedRef.current) {
        socket.emit('VOICE_STATUS_UPDATE', {
          roomCode: code,
          isMuted: false,
          hasMic: true,
        });
      }
      return;
    }

    // Nếu chưa có mic hoặc chưa cấp quyền mic: Tiến hành yêu cầu micro!
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionState('unsupported');
      setErrorMessage('Trình duyệt của bạn không hỗ trợ Micro đàm thoại WebRTC. Bạn vẫn đang ở chế độ Nghe bình thường 🎧.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      localStreamRef.current = stream;
      setHasMic(true);
      hasMicRef.current = true;
      setIsMuted(false);
      isMutedRef.current = false;
      setPermissionState('granted');
      setErrorMessage(null);

      // Kích hoạt bộ phân tích sóng âm thanh
      setupAudioAnalyser(stream);

      // Gắn track audio mới vào tất cả PeerConnection hiện có và renegotiate
      const audioTrack = stream.getAudioTracks()[0];
      peerConnectionsRef.current.forEach(async (pc, targetSocketId) => {
        try {
          const transceivers = pc.getTransceivers();
          const audioTransceiver = transceivers.find(
            (t) => t.receiver.track.kind === 'audio' || t.sender.track?.kind === 'audio'
          );

          if (audioTransceiver) {
            await audioTransceiver.sender.replaceTrack(audioTrack);
            audioTransceiver.direction = 'sendrecv';
          } else {
            pc.addTrack(audioTrack, stream);
          }

          // Renegotiate với peer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          if (roomCodeRef.current && pc.localDescription) {
            socket.emit('VOICE_SIGNAL', {
              roomCode: roomCodeRef.current,
              targetSocketId,
              signal: {
                type: 'offer',
                sdp: pc.localDescription,
              },
            });
          }
        } catch (renegErr) {
          console.error('Error renegotiating track with peer:', targetSocketId, renegErr);
        }
      });

      // Báo trạng thái lên server
      const code = roomCodeRef.current;
      if (code && isVoiceJoinedRef.current) {
        socket.emit('VOICE_STATUS_UPDATE', {
          roomCode: code,
          isMuted: false,
          isSpeaking: false,
          hasMic: true,
        });
      }
    } catch (err: any) {
      console.warn('Microphone access failed:', err);
      setHasMic(false);
      hasMicRef.current = false;
      setIsMuted(true);
      isMutedRef.current = true;

      if (
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        err.name === 'SecurityError'
      ) {
        setPermissionState('denied');
        setErrorMessage(
          'Quyền truy cập Microphone bị từ chối. Bạn vẫn nghe mọi người nói bình thường! 🎧 (Bấm biểu tượng ổ khóa 🔒 trên thanh địa chỉ nếu bạn muốn cấp quyền mic).'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionState('unsupported');
        setErrorMessage(
          'Không tìm thấy thiết bị Microphone trên máy của bạn. Bạn vẫn đang ở chế độ Nghe phòng bình thường! 🎧'
        );
      } else {
        setErrorMessage(
          'Không thể khởi động Microphone. Bạn vẫn đang ở chế độ Nghe phòng bình thường! 🎧'
        );
      }
    }
  }, [setupAudioAnalyser]);

  // Toggle Deafen (Tắt / Bật tiếng loa nghe phòng)
  const toggleDeafen = useCallback(() => {
    setIsDeafened((prev) => {
      const next = !prev;
      audioElementsRef.current.forEach((audio) => {
        audio.muted = next;
      });
      return next;
    });
  }, []);

  // Adjust volume for specific peer
  const setPeerVolume = useCallback((socketId: string, volume: number) => {
    setPeerVolumes((prev) => ({ ...prev, [socketId]: volume }));
    const audio = audioElementsRef.current.get(socketId);
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, volume));
    }
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupVoiceSession();
    };
  }, [cleanupVoiceSession]);

  return (
    <VoiceChatContext.Provider
      value={{
        isVoiceJoined,
        isConnecting,
        hasMic,
        isMuted,
        isDeafened,
        isSpeaking,
        needsAudioUnlock,
        permissionState,
        errorMessage,
        participants,
        speakingMap,
        volumeLevel,
        peerVolumes,
        joinVoice,
        leaveVoice,
        toggleMute,
        toggleDeafen,
        setPeerVolume,
        unlockAudio,
        clearError,
      }}
    >
      {children}
    </VoiceChatContext.Provider>
  );
};

export const useVoiceChat = () => {
  const context = useContext(VoiceChatContext);
  if (!context) {
    throw new Error('useVoiceChat must be used within a VoiceChatProvider');
  }
  return context;
};
