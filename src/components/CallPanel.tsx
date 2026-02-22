import { Phone, PhoneCall, PhoneIncoming } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CallStatus, ConnectionStatus, UserType } from '@/hooks/useWebRTC';
import { RefObject } from 'react';

interface CallPanelProps {
  connectionStatus: ConnectionStatus;
  callStatus: CallStatus;
  userType: UserType;
  remoteAudioRef: RefObject<HTMLAudioElement | null>;
  onStartCall: () => void;
  onAnswerCall: () => void;
}

export function CallPanel({ connectionStatus, callStatus, remoteAudioRef, onStartCall, onAnswerCall }: CallPanelProps) {
  const isConnected = connectionStatus === 'connected';
  const isIdle = callStatus === 'idle';
  const isRinging = callStatus === 'ringing';
  const isInCall = callStatus === 'in-call';

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
          <Phone className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">Chamada</h2>
          <p className="text-sm text-muted-foreground">
            {isInCall ? 'Em chamada' : isRinging ? 'Chamada recebida!' : 'Controles de áudio'}
          </p>
        </div>
        {isRinging && (
          <div className="ml-auto relative">
            <span className="pulse-ring absolute inset-0 rounded-full bg-accent/30" />
            <span className="status-dot status-dot-connected" />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          onClick={onStartCall}
          disabled={!isConnected || !isIdle}
          className="flex-1 bg-primary hover:bg-primary/90"
        >
          <PhoneCall className="mr-2 h-4 w-4" />
          Ligar
        </Button>
        <Button
          onClick={onAnswerCall}
          disabled={!isConnected || !isRinging}
          className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <PhoneIncoming className="mr-2 h-4 w-4" />
          Atender
        </Button>
      </div>

      <div className="mt-5">
        <audio ref={remoteAudioRef} autoPlay controls className="w-full rounded-lg" />
      </div>
    </div>
  );
}
