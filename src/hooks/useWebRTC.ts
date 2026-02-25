import { useState, useRef, useCallback } from 'react';

export type UserType = 'client' | 'user';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type CallStatus = 'idle' | 'calling' | 'ringing' | 'in-call';
export type CallMode = 'audio' | 'video';

export interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface UseWebRTCOptions {
  wsUrl: string;
  userType: UserType;
  userId: string;
  chatId: string;
  token: string;
}

const RTC_CONFIG: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
            urls: 'turn:3.238.87.0:3478',
            username: 'user',
            credential: 'pass'
        }
    ]
};

export function useWebRTC() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callMode, setCallMode] = useState<CallMode>('audio');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const chatIdRef = useRef<number>(0);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      time: new Date().toLocaleTimeString(),
      message,
      type,
    }]);
  }, []);

  const setupWebRTC = useCallback(async (mode: CallMode) => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
        },
        video: mode === 'video' ? {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      addLog(`${mode === 'video' ? 'Câmera e microfone' : 'Microfone'} capturado com sucesso!`, 'success');

      if (mode === 'video') {
        // Aumente este tempo para garantir que a renderização do React terminou
        setTimeout(() => {
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        }, 200);
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;
      pc.oniceconnectionstatechange = () => {
        console.log("Status da Conexão de Mídia (ICE):", pc.iceConnectionState);
      };

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        const track = event.track;
        addLog(`Mídia remota recebida (${track.kind})!`, 'success');

        // Graças à correção no Go, event.streams[0] agora contém ÁUDIO E VÍDEO juntos!
        const stream = event.streams[0];

        if (mode === 'video') {
          if (remoteVideoRef.current && stream) {
            if (remoteVideoRef.current.srcObject !== stream) {
              remoteVideoRef.current.srcObject = stream;
            }

            // O SEGREDO PARA CELULAR: Forçar o play para evitar a "tela congelada"
            remoteVideoRef.current.play().catch(err => {
              console.warn("Celular bloqueou o autoplay. O usuário precisa interagir.", err);
            });
          }
        } else {
          if (remoteAudioRef.current && stream) {
            if (remoteAudioRef.current.srcObject !== stream) {
              remoteAudioRef.current.srcObject = stream;
            }
            remoteAudioRef.current.play().catch(err => console.warn("Autoplay de áudio bloqueado:", err));
          }
        }

        setCallStatus('in-call');
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current) {
          addLog('Enviando ICE Candidate...', 'info');
          wsRef.current.send(JSON.stringify({
            type: 'event_ice',
            chat_id: chatIdRef.current,
            payload: event.candidate,
          }));
        }
      };

      return pc;
    } catch (err) {
      addLog(`Erro de mídia: ${err}`, 'error');
      setCallStatus('idle');
      throw err;
    }
  }, [addLog]);

  const connect = useCallback(async (options: UseWebRTCOptions) => {
    const { wsUrl, userType, userId, chatId, token } = options;
    chatIdRef.current = parseInt(chatId);
    setConnectionStatus('connecting');

    const finalUrl = `${wsUrl}?user_id=${userId}&user_type=${userType}&token=${token}`;

    try {
      const ws = new WebSocket(finalUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        addLog(`Conectado como ${userType === 'client' ? 'Cliente' : 'Atendente'} (ID: ${userId})`, 'success');
        setConnectionStatus('connected');
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        addLog(`Mensagem recebida: ${msg.type}`, 'info');

        if (msg.type === 'webrtc_answer') {
          addLog('Answer recebida. Conectando áudio...', 'success');
          await pcRef.current?.setRemoteDescription(new RTCSessionDescription(msg.payload));
        }

        if (msg.type === 'call_incoming') {
          addLog(`Chamada recebida! Tipo: ${msg.mode}`, 'warning');
          setCallMode(msg.mode || 'audio');
          setCallStatus('ringing');
        }
      };

      ws.onclose = () => {
        addLog('WebSocket desconectado.', 'error');
        setConnectionStatus('disconnected');
        setCallStatus('idle');
      };

      ws.onerror = () => {
        addLog('Erro na conexão WebSocket.', 'error');
        setConnectionStatus('disconnected');
      };
    } catch {
      addLog('Falha ao conectar.', 'error');
      setConnectionStatus('disconnected');
    }
  }, [addLog]);

  const startCall = useCallback(async (mode: CallMode) => {
    try {
      setCallStatus('calling');
      setCallMode(mode);
      const pc = await setupWebRTC(mode);

      addLog('Criando oferta (Offer)...', 'info');
      const offer = await pc.createOffer();

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'webrtc_offer',
          chat_id: chatIdRef.current,
          mode: mode,
          payload: offer,
        }));
        addLog('Oferta enviada para o servidor.', 'success');
      }

      await pc.setLocalDescription(offer);

    } catch (err) {
      console.error(err);
      setCallStatus('idle');
    }
  }, [setupWebRTC, addLog]);

  const answerCall = useCallback(async (mode: CallMode) => {
    try {
      setCallStatus('calling');
      setCallMode(mode);
      const pc = await setupWebRTC(mode);

      addLog('Criando oferta do atendente...', 'info');
      const offer = await pc.createOffer();

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'webrtc_offer',
          chat_id: chatIdRef.current,
          mode: mode,
          payload: offer,
        }));
        addLog('Oferta do atendente enviada.', 'success');
      }

      await pc.setLocalDescription(offer);

    } catch (err) {
      console.error(err);
      setCallStatus('idle');
    }
  }, [setupWebRTC, addLog]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    setConnectionStatus('disconnected');
    setCallStatus('idle');
    addLog('Desconectado.', 'info');
  }, [addLog]);

  return {
    connectionStatus,
    callStatus,
    callMode,
    logs,
    remoteAudioRef,
    remoteVideoRef,
    localVideoRef,
    connect,
    disconnect,
    startCall,
    answerCall,
    addLog,
  };
}
