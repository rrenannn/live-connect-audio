import { useState, useRef, useCallback } from 'react';

export type UserType = 'client' | 'user';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type CallStatus = 'idle' | 'calling' | 'ringing' | 'in-call';

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
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function useWebRTC() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const chatIdRef = useRef<number>(0);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      time: new Date().toLocaleTimeString(),
      message,
      type,
    }]);
  }, []);

  const setupWebRTC = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    addLog('Microfone capturado com sucesso!', 'success');

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      addLog('Áudio remoto recebido! Tocando agora...', 'success');
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
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

  const startCall = useCallback(async () => {
    setCallStatus('calling');
    const pc = await setupWebRTC();

    addLog('Criando oferta (Offer)...', 'info');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    wsRef.current?.send(JSON.stringify({
      type: 'webrtc_offer',
      chat_id: chatIdRef.current,
      payload: pc.localDescription,
    }));
    addLog('Oferta enviada para o servidor.', 'success');
  }, [setupWebRTC, addLog]);

  const answerCall = useCallback(async () => {
    setCallStatus('calling');
    const pc = await setupWebRTC();

    addLog('Criando oferta do atendente...', 'info');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    wsRef.current?.send(JSON.stringify({
      type: 'webrtc_offer',
      chat_id: chatIdRef.current,
      payload: pc.localDescription,
    }));
    addLog('Oferta do atendente enviada.', 'success');
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
    logs,
    remoteAudioRef,
    connect,
    disconnect,
    startCall,
    answerCall,
    addLog,
  };
}
