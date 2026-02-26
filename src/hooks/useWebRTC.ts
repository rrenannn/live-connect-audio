import { useState, useRef, useCallback } from 'react';

export type UserType = 'client' | 'user';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type CallStatus = 'idle' | 'in-call'; // Removemos calling e ringing
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

  // NOVO: Controle da sala ativa
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const chatIdRef = useRef<number>(0);
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);

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
        const incomingStream = event.streams[0];
        if (incomingStream) {
          setRemoteStreams(prevStreams => {
            if (!prevStreams.find(s => s.id === incomingStream.id)) {
              return [...prevStreams, incomingStream];
            }
            return prevStreams;
          });
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'webrtc_ice_candidate',
            room_id: activeRoomIdRef.current, // Só a sala
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

        if (msg.type === 'webrtc_answer') {
          addLog('Conexão estabelecida com a sala.', 'success');
          await pcRef.current?.setRemoteDescription(new RTCSessionDescription(msg.payload));
        }

        if (msg.type === 'webrtc_server_offer') {
          addLog('Nova mídia na sala! Atualizando...', 'info');
          const pc = pcRef.current;
          if (!pc) return;

          await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          wsRef.current?.send(JSON.stringify({
            type: 'webrtc_client_answer',
            room_id: msg.room_id, // Só a sala devolvida pelo Go
            payload: pc.localDescription,
          }));

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        setCallStatus('idle');
      };
      ws.onerror = () => setConnectionStatus('disconnected');
    } catch {
      setConnectionStatus('disconnected');
    }
  }, [addLog]);

  // NOVO: Cria uma sala do zero
  const startCall = useCallback(async (mode: CallMode) => {
    try {
      // 1. Gera um ID de sala puro e independente
      const newRoomId = `meet_${Math.random().toString(36).substring(2, 9)}`;
      setActiveRoomId(newRoomId);
      activeRoomIdRef.current = newRoomId;

      setCallStatus('in-call');
      setCallMode(mode);

      const pc = await setupWebRTC(mode);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'webrtc_offer',
          // ADEUS chat_id! Só mandamos a sala.
          room_id: newRoomId,
          mode: mode,
          payload: offer,
        }));
        addLog(`Sala ${newRoomId} criada.`, 'success');
      }
    } catch (err) {
      console.error(err);
      setCallStatus('idle');
    }
  }, [setupWebRTC, addLog]);

  // NOVO: Entra numa sala existente
  const joinCall = useCallback(async (roomIdToJoin: string, mode: CallMode) => {
    if (!roomIdToJoin) return;
    try {
      setActiveRoomId(roomIdToJoin);
      activeRoomIdRef.current = roomIdToJoin;

      setCallStatus('in-call');
      setCallMode(mode);

      const pc = await setupWebRTC(mode);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'webrtc_offer',
          chat_id: chatIdRef.current,
          room_id: roomIdToJoin,
          mode: mode,
          payload: offer,
        }));
        addLog(`Entrando na sala ${roomIdToJoin}...`, 'info');
      }
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
    setActiveRoomId(null);
    activeRoomIdRef.current = null;
    setRemoteStreams([]); // Limpa a tela para a próxima call
    addLog('Desconectado da sala.', 'info');
  }, [addLog]);

  return {
    connectionStatus,
    callStatus,
    callMode,
    activeRoomId, // Exportado para a UI
    logs,
    remoteStreams,
    localVideoRef,
    connect,
    disconnect,
    startCall,
    joinCall, // Substituiu o answerCall
    addLog,
  };
}