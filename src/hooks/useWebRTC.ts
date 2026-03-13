import { useState, useRef, useCallback } from 'react';

export type UserType = 'client' | 'user';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type CallStatus = 'idle' | 'in-call';
export type CallMode = 'audio' | 'video';

export interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface IncomingCall {
  roomId: string;
  callerName: string;
  mode: CallMode;
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
  ]
};

export function useWebRTC() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callMode, setCallMode] = useState<CallMode>('audio');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [agentPendingCall, setAgentPendingCall] = useState<any>(null);

  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
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
        const incomingStream = event.streams && event.streams.length > 0
            ? event.streams[0]
            : new MediaStream([event.track]);

        setRemoteStreams(prevStreams => {
          if (!prevStreams.find(s => s.id === incomingStream.id)) {
            return [...prevStreams, incomingStream];
          }
          return prevStreams;
        });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'webrtc_ice_candidate',
            room_id: activeRoomIdRef.current,
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
    const { wsUrl, userType, userId, token } = options;
    if (!wsUrl || wsUrl.trim() === '') {
      addLog('Erro: Preencha a URL do WebSocket!', 'error');
      return;
    }
    if (!userId || userId.trim() === '') {
      addLog('Erro: Preencha o seu ID!', 'error');
      return;
    }

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

        if (msg.type === 'novo_chamado_recebido') {
          addLog(`Novo atendimento atribuído da fila!`, 'info');
          setAgentPendingCall({
            roomId: msg.payload.room_id,
            targetUserId: msg.payload.target_user_id,
            targetUserType: msg.payload.target_user_type,
            mode: msg.payload.mode,
            callerName: msg.payload.nome_solicitante,
            assunto: msg.payload.assunto
          });
        }

        if (msg.type === 'webrtc_incoming_call') {
          addLog(`Recebendo ligação de ${msg.payload.caller_name}...`, 'info');
          setIncomingCall({
            roomId: msg.room_id,
            callerName: msg.payload.caller_name,
            mode: msg.mode as CallMode
          });
        }

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
            room_id: msg.room_id,
            payload: pc.localDescription,
          }));
        }

        if (msg.type === 'webrtc_ice_candidate') {
          if (pcRef.current && msg.payload) {
            pcRef.current.addIceCandidate(new RTCIceCandidate(msg.payload))
                .catch(err => console.error("Erro ao adicionar ICE Candidate do servidor:", err));
          }
        }
      };

      ws.onclose = () => {
        addLog('WebSocket desconectado pelo servidor.', 'warning');
        setConnectionStatus('disconnected');
        setCallStatus('idle');
      };

      ws.onerror = (error) => {
        console.error("Erro interno do WebSocket:", error);
        addLog('Erro na conexão WebSocket.', 'error');
        setConnectionStatus('disconnected');
      };

    } catch (err) {
      console.error("Erro fatal ao criar WebSocket:", err);
      setConnectionStatus('disconnected');
    }
  }, [addLog]);

  const startCall = useCallback(async (
      mode: CallMode,
      targetUserType?: string,
      targetUserId?: string,
      providedRoomId?: string // <-- Novo parâmetro opcional adicionado aqui
  ) => {
    try {
      // Se o back-end mandar o ID da sala (ex: meet_atd_54), ele usa. Se não, gera aleatório (Fallback)
      const newRoomId = providedRoomId || `meet_${Math.random().toString(36).substring(2, 9)}`;

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
          room_id: newRoomId,
          mode: mode,
          payload: offer,
        }));

        if (targetUserType && targetUserId) {
          wsRef.current.send(JSON.stringify({
            type: 'webrtc_invite',
            room_id: newRoomId,
            mode: mode,
            payload: {
              caller_name: "Atendente", // No futuro pode trocar para o nome real do atendente logado
              convidados: [
                { user_type: targetUserType, user_id: Number(targetUserId) }
              ]
            }
          }));
          addLog(`Ligando para ${targetUserType} ${targetUserId} na sala ${newRoomId}...`, 'info');
        } else {
          addLog(`Sala ${newRoomId} criada.`, 'success');
        }
      }
    } catch (err) {
      console.error(err);
      addLog(`Falha ao criar sala.`, 'error');
      setCallStatus('idle');
    }
  }, [setupWebRTC, addLog]);

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
          room_id: roomIdToJoin,
          mode: mode,
          payload: offer,
        }));
        addLog(`Entrando na sala ${roomIdToJoin}...`, 'info');
      }
    } catch (err) {
      console.error(err);
      addLog(`Falha ao entrar na sala.`, 'error');
      setCallStatus('idle');
    }
  }, [setupWebRTC, addLog]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    await joinCall(incomingCall.roomId, incomingCall.mode);
    setIncomingCall(null);
  }, [incomingCall, joinCall]);

  const rejectCall = useCallback(() => {
    setIncomingCall(null);
    addLog('Ligação recusada.', 'warning');
  }, [addLog]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    setConnectionStatus('disconnected');
    setCallStatus('idle');
    setActiveRoomId(null);
    activeRoomIdRef.current = null;
    setRemoteStreams([]);
    setIncomingCall(null);

    addLog('Desconectado com sucesso.', 'info');
  }, [addLog]);

  return {
    connectionStatus, callStatus, callMode, activeRoomId, logs, remoteStreams, localVideoRef,
    incomingCall, connect, disconnect, startCall, joinCall, acceptCall, rejectCall, addLog,
  };
}