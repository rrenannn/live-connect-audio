import { Phone, PhoneCall, Video, LogIn, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CallStatus, ConnectionStatus, CallMode } from '@/hooks/useWebRTC';
import { RefObject, useState, useEffect, useRef } from 'react';

function RemoteMedia({ stream, isVideo }: { stream: MediaStream; isVideo: boolean }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (isVideo && videoRef.current && videoRef.current.srcObject !== stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => console.warn("Autoplay prevenido", e));
        } else if (!isVideo && audioRef.current && audioRef.current.srcObject !== stream) {
            audioRef.current.srcObject = stream;
            audioRef.current.play().catch(e => console.warn("Autoplay prevenido", e));
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

interface CallPanelProps {
    connectionStatus: ConnectionStatus;
    callStatus: CallStatus;
    callMode: CallMode;
    activeRoomId: string | null;
    localVideoRef: RefObject<HTMLVideoElement | null>;
    remoteStreams: MediaStream[];
    onStartCall: (mode: CallMode) => void;
    onJoinCall: (roomId: string, mode: CallMode) => void;
}

export function CallPanel({
                              connectionStatus,
                              callStatus,
                              callMode,
                              activeRoomId,
                              localVideoRef,
                              remoteStreams,
                              onStartCall,
                              onJoinCall
                          }: CallPanelProps) {
    const isConnected = connectionStatus === 'connected';
    const isIdle = callStatus === 'idle';
    const isInCall = callStatus === 'in-call';
    const [selectedMode, setSelectedMode] = useState<CallMode>('video');
    const [roomInput, setRoomInput] = useState('');

    const showVideo = isInCall && callMode === 'video';

    return (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                    {callMode === 'video' ? <Video className="h-5 w-5 text-accent" /> : <Phone className="h-5 w-5 text-accent" />}
                </div>
                <div className="flex-1">
                    <h2 className="text-lg font-semibold text-card-foreground">Sala de Reunião</h2>
                    <p className="text-sm text-muted-foreground">
                        {isInCall ? `Conectado (${remoteStreams.length + 1} na sala)` : 'Pronto para conectar'}
                    </p>
                </div>
            </div>

            {/* Mostrar ID da Sala Ativa */}
            {isInCall && activeRoomId && (
                <div className="mb-4 flex items-center justify-between bg-muted/50 p-3 rounded-lg border border-border">
                    <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">ID da Sala</p>
                        <code className="text-sm font-bold text-foreground">{activeRoomId}</code>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(activeRoomId)}
                        title="Copiar ID da Sala"
                    >
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {isIdle && (
                <>
                    <div className="mb-4 flex gap-2">
                        <button
                            onClick={() => setSelectedMode('audio')}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                                selectedMode === 'audio'
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
                            }`}
                        >
                            <Phone className="h-4 w-4" /> Áudio
                        </button>
                        <button
                            onClick={() => setSelectedMode('video')}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                                selectedMode === 'video'
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
                            }`}
                        >
                            <Video className="h-4 w-4" /> Vídeo
                        </button>
                    </div>

                    <div className="space-y-4">
                        <Button
                            onClick={() => onStartCall(selectedMode)}
                            disabled={!isConnected}
                            className="w-full bg-primary hover:bg-primary/90 py-6"
                        >
                            {selectedMode === 'video' ? <Video className="mr-2 h-5 w-5" /> : <PhoneCall className="mr-2 h-5 w-5" />}
                            Nova Reunião
                        </Button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Ou</span></div>
                        </div>

                        <div className="flex gap-2">
                            <Input
                                placeholder="Cole o ID da sala..."
                                value={roomInput}
                                onChange={(e) => setRoomInput(e.target.value)}
                                className="flex-1"
                            />
                            <Button
                                onClick={() => onJoinCall(roomInput, selectedMode)}
                                disabled={!isConnected || !roomInput}
                                variant="secondary"
                            >
                                <LogIn className="mr-2 h-4 w-4" />
                                Entrar
                            </Button>
                        </div>
                    </div>
                </>
            )}

            {/* Mosaico de Vídeo Dinâmico */}
            {showVideo && (
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
                    {remoteStreams.map((stream) => (
                        <RemoteMedia key={stream.id} stream={stream} isVideo={true} />
                    ))}
                </div>
            )}

            {/* Controle de Áudio Dinâmico */}
            {!showVideo && isInCall && (
                <div className="mt-5 flex flex-col gap-2">
                    {remoteStreams.map((stream) => (
                        <RemoteMedia key={stream.id} stream={stream} isVideo={false} />
                    ))}
                </div>
            )}
        </div>
    );
}