import { useState } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConnectionStatus, UserType } from '@/hooks/useWebRTC';

interface ConnectionPanelProps {
  status: ConnectionStatus;
  onConnect: (opts: { wsUrl: string; userType: UserType; userId: string; token: string }) => void;
  onDisconnect: () => void;
}

export function ConnectionPanel({ status, onConnect, onDisconnect }: ConnectionPanelProps) {
  const [userType, setUserType] = useState<UserType>('client');
  const [userId, setUserId] = useState('');

  const [wsUrl, setWsUrl] = useState('');
  const [token, setToken] = useState('');

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Wifi className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">Conexão</h2>
          <p className="text-sm text-muted-foreground">Configure o WebSocket e identidade</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`status-dot ${isConnected ? 'status-dot-connected' : 'status-dot-disconnected'}`} />
          <span className="text-sm font-medium text-muted-foreground">
            {isConnected ? 'Conectado' : isConnecting ? 'Conectando...' : 'Desconectado'}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tipo de Usuário</Label>
          <div className="flex gap-2">
            <button
              onClick={() => setUserType('client')}
              disabled={isConnected}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                userType === 'client'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              } disabled:opacity-50`}
            >
              Cliente
            </button>
            <button
              onClick={() => setUserType('user')}
              disabled={isConnected}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                userType === 'user'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              } disabled:opacity-50`}
            >
              Atendente
            </button>
          </div>
        </div>

        <div className="space-y-2">
            <Label htmlFor="userId">Seu ID</Label>
            <Input id="userId" type="number" value={userId} onChange={e => setUserId(e.target.value)} disabled={isConnected} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="wsUrl">URL do WebSocket</Label>
          <Input id="wsUrl" value={wsUrl} onChange={e => setWsUrl(e.target.value)} disabled={isConnected} className="font-mono text-sm" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="token">Token</Label>
          <Input id="token" value={token} onChange={e => setToken(e.target.value)} disabled={isConnected} className="font-mono text-xs" />
        </div>
      </div>

      <div className="mt-5">
        {isConnected ? (
          <Button variant="destructive" onClick={onDisconnect} className="w-full">
            <WifiOff className="mr-2 h-4 w-4" /> Desconectar
          </Button>
        ) : (
          <Button onClick={() => onConnect({ wsUrl, userType, userId, token })} disabled={isConnecting} className="w-full">
            {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />}
            Conectar
          </Button>
        )}
      </div>
    </div>
  );
}
