import { Phone, PhoneCall, PhoneIncoming, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CallStatus, ConnectionStatus, UserType, CallMode } from '@/hooks/useWebRTC';
import { RefObject, useState, useEffect, useRef } from 'react';

// --- NOVO SUBCOMPONENTE: Gerencia a mídia de CADA participante dinamicamente ---
function RemoteMedia({ stream, isVideo }: { stream: MediaStream; isVideo: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Injeta a stream na tag HTML correta assim que o componente renderizar
    if (isVideo && videoRef.current) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(e => console.warn("Autoplay prevenido:", e));
    } else if (!isVideo && audioRef.current) {
      if (audioRef.current.srcObject !== stream) {
        audioRef.current.srcObject = stream;
      }
      audioRef.current.play().catch(e => console.warn("Autoplay prevenido:", e));
    }
  }, [stream, isVideo]);

  if (isVideo) {
    return (
        <div className="relative rounded-lg overflow-hidden bg-black aspect-video shadow-inner">
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur-md">
          Participante
        </span>
        </div>
    );
  }

  return <audio ref={audioRef} autoPlay playsInline controls className="w-full rounded-lg mb-2" />;
}
// --------------------------------------------------------------------------------

interface CallPanelProps {
  connectionStatus: ConnectionStatus;
  callStatus: CallStatus;
  callMode: CallMode;
  userType: UserType;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  remoteStreams: MediaStream[]; // <-- NOVA PROP: Array de fluxos de mídia
  onStartCall: (mode: CallMode) => void;
  onAnswerCall: (mode: CallMode) => void;
}

export function CallPanel({
                            connectionStatus,
                            callStatus,
                            callMode,
                            localVideoRef,
                            remoteStreams, // <-- Recebe o array do useWebRTC
                            onStartCall,
                            onAnswerCall
                          }: CallPanelProps) {
  const isConnected = connectionStatus === 'connected';
  const isIdle = callStatus === 'idle';
  const isRinging = callStatus === 'ringing';
  const isInCall = callStatus === 'in-call';
  const [selectedMode, setSelectedMode] = useState<CallMode>('audio');

  const showVideo = (callStatus === 'calling' && selectedMode === 'video') ||
      (isInCall && callMode === 'video') ||
      (isRinging && selectedMode === 'video');

  return (
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Phone className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">Sala de Reunião</h2>
            <p className="text-sm text-muted-foreground">
              {isInCall ? (callMode === 'video' ? `Em vídeo (${remoteStreams.length + 1} na sala)` : 'Em chamada de áudio') : isRinging ? 'Chamada recebida!' : 'Controles de mídia'}
            </p>
          </div>
          {isRinging && (
              <div className="ml-auto relative">
                <span className="pulse-ring absolute inset-0 rounded-full bg-accent/30" />
                <span className="status-dot status-dot-connected" />
              </div>
          )}
        </div>

        {/* Mode selector */}
        {isIdle && (
            <div className="mb-4 flex gap-2">
              <button
                  onClick={() => setSelectedMode('audio')}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                      selectedMode === 'audio'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
              >
                <Phone className="h-4 w-4" />
                Áudio
              </button>
              <button
                  onClick={() => setSelectedMode('video')}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                      selectedMode === 'video'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
              >
                <Video className="h-4 w-4" />
                Vídeo
              </button>
            </div>
        )}

        <div className="flex gap-3">
          <Button
              onClick={() => onStartCall(selectedMode)}
              disabled={!isConnected || !isIdle}
              className="flex-1 bg-primary hover:bg-primary/90"
          >
            {selectedMode === 'video' ? <Video className="mr-2 h-4 w-4" /> : <PhoneCall className="mr-2 h-4 w-4" />}
            {selectedMode === 'video' ? 'Iniciar Reunião' : 'Ligar'}
          </Button>
          <Button
              onClick={() => onAnswerCall(selectedMode)}
              disabled={!isConnected || !isRinging}
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <PhoneIncoming className="mr-2 h-4 w-4" />
            Entrar na Sala
          </Button>
        </div>

        {/* Mosaico de Vídeo Dinâmico */}
        {showVideo && (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {/* O Seu Vídeo Local */}
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video shadow-inner">
                <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover -scale-x-100"
                />
                <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur-md">Você</span>
              </div>

              {/* Mapeia os vídeos de todos os outros participantes */}
              {remoteStreams.map((stream) => (
                  <RemoteMedia key={stream.id} stream={stream} isVideo={true} />
              ))}
            </div>
        )}

        {/* Controle de Áudio Dinâmico */}
        {!showVideo && isInCall && (
            <div className="mt-5">
              {remoteStreams.map((stream) => (
                  <RemoteMedia key={stream.id} stream={stream} isVideo={false} />
              ))}
            </div>
        )}
      </div>
  );
}