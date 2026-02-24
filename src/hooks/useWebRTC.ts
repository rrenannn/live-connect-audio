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

  const sendWs = useCallback((data: unknown) => {
    const ws = wsRef.current;
    if (!ws) {
      addLog('WebSocket não inicializado. Conecte antes de iniciar a chamada.', 'error');
      return false;
    }
    if (ws.readyState !== WebSocket.OPEN) {
      addLog(`WebSocket não está aberto (state: ${ws.readyState}). Aguarde conectar.`, 'error');
      return false;
    }

    ws.send(JSON.stringify(data));
    return true;
  }, [addLog]);

  const setupWebRTC = useCallback(async (mode: CallMode) => {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000,
      },
      video: mode === 'video' ? { width: 640, height: 480, frameRate: 30 } : false,
    };

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      const details = err instanceof Error ? err.message : String(err);
      addLog(`Falha ao capturar ${mode === 'video' ? 'câmera/microfone' : 'microfone'}: ${details}`, 'error');
      throw err;
    }

    localStreamRef.current = stream;
    addLog(`${mode === 'video' ? 'Câmera e microfone' : 'Microfone'} capturado com sucesso!`, 'success');

    if (mode === 'video' && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
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
      if (track.kind === 'video' && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      if (track.kind === 'audio' && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
      setCallStatus('in-call');
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addLog('Enviando ICE Candidate...', 'info');
        sendWs({
          type: 'event_ice',
          chat_id: chatIdRef.current,
          payload: event.candidate,
        });
      }
    };

    return pc;
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
          addLog('Chamada recebida! O cliente iniciou a ligação.', 'warning');
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
    setCallMode(mode);
    setCallStatus('calling');

    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        addLog('WebSocket não está conectado; não é possível enviar webrtc_offer.', 'error');
        setCallStatus('idle');
        return;
      }

      const pc = await setupWebRTC(mode);

      addLog('Criando oferta (Offer)...', 'info');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const ok = sendWs({
        type: 'webrtc_offer',
        chat_id: chatIdRef.current,
        payload: pc.localDescription,
      });

      if (!ok) {
        setCallStatus('idle');
        return;
      }

      addLog('Oferta enviada para o servidor.', 'success');
    } catch (err) {
      const details = err instanceof Error ? err.message : String(err);
      addLog(`Falha ao iniciar chamada: ${details}`, 'error');
      setCallStatus('idle');
    }
  }, [setupWebRTC, addLog, sendWs]);

  const answerCall = useCallback(async (mode: CallMode) => {
    setCallMode(mode);
    setCallStatus('calling');

    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        addLog('WebSocket não está conectado; não é possível enviar webrtc_offer.', 'error');
        setCallStatus('idle');
        return;
      }

      const pc = await setupWebRTC(mode);

      addLog('Criando oferta do atendente...', 'info');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const ok = sendWs({
        type: 'webrtc_offer',
        chat_id: chatIdRef.current,
        payload: pc.localDescription,
      });

      if (!ok) {
        setCallStatus('idle');
        return;
      }

      addLog('Oferta do atendente enviada.', 'success');
    } catch (err) {
      const details = err instanceof Error ? err.message : String(err);
      addLog(`Falha ao atender chamada: ${details}`, 'error');
      setCallStatus('idle');
    }
  }, [setupWebRTC, addLog, sendWs]);

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
