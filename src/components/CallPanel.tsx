import { Phone, PhoneCall, PhoneIncoming, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CallStatus, ConnectionStatus, UserType, CallMode } from '@/hooks/useWebRTC';
import { RefObject, useState } from 'react';

interface CallPanelProps {
  connectionStatus: ConnectionStatus;
  callStatus: CallStatus;
  callMode: CallMode;
  userType: UserType;
  remoteAudioRef: RefObject<HTMLAudioElement | null>;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  onStartCall: (mode: CallMode) => void;
  onAnswerCall: (mode: CallMode) => void;
}

export function CallPanel({ connectionStatus, callStatus, callMode, remoteAudioRef, remoteVideoRef, localVideoRef, onStartCall, onAnswerCall }: CallPanelProps) {
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
          <h2 className="text-lg font-semibold text-card-foreground">Chamada</h2>
          <p className="text-sm text-muted-foreground">
            {isInCall ? (callMode === 'video' ? 'Em vídeo chamada' : 'Em chamada de áudio') : isRinging ? 'Chamada recebida!' : 'Controles de mídia'}
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
          {selectedMode === 'video' ? 'Vídeo Chamada' : 'Ligar'}
        </Button>
        <Button
          onClick={() => onAnswerCall(selectedMode)}
          disabled={!isConnected || !isRinging}
          className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <PhoneIncoming className="mr-2 h-4 w-4" />
          Atender
        </Button>
      </div>

      {/* Video area */}
      {showVideo && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Local Video - Sua Câmera */}
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video shadow-inner">
              <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover -scale-x-100" // -scale-x-100 faz o efeito espelho (mais natural)
              />
              <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur-md">Você</span>
            </div>

            {/* Remote Video - Câmera do outro */}
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video shadow-inner">
              <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
              />
              <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur-md">Remoto</span>
            </div>
          </div>
      )}

      {/* Audio Controls - Só mostra se NÃO for vídeo para evitar áudio duplicado */}
      {!showVideo && (
          <div className="mt-5">
            <audio
                ref={remoteAudioRef}
                autoPlay
                playsInline
                controls={isInCall}
                className="w-full rounded-lg"
            />
          </div>
      )}
    </div>
  );
}
