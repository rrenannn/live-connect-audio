import { useState } from 'react';
import { Headphones } from 'lucide-react';
import { useWebRTC, UserType } from '@/hooks/useWebRTC';
import { ConnectionPanel } from '@/components/ConnectionPanel';
import { CallPanel } from '@/components/CallPanel';
import { LogPanel } from '@/components/LogPanel';

const Index = () => {
  const { connectionStatus, callStatus, callMode, logs, remoteStreams, localVideoRef, connect, disconnect, startCall, answerCall } = useWebRTC();
  const [userType, setUserType] = useState<UserType>('client');

  const handleConnect = (opts: { wsUrl: string; userType: UserType; userId: string; token: string }) => {
    setUserType(opts.userType);
    connect(opts);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Headphones className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">WebRTC Audio</h1>
            <p className="text-xs text-muted-foreground">Go SFU Test Client</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <ConnectionPanel status={connectionStatus} onConnect={handleConnect} onDisconnect={disconnect} />
        <CallPanel
          connectionStatus={connectionStatus}
          callStatus={callStatus}
          callMode={callMode}
          userType={userType}
          remoteStreams={remoteStreams}
          localVideoRef={localVideoRef}
          onStartCall={startCall}
          onAnswerCall={answerCall}
        />
        <LogPanel logs={logs} />
      </main>
    </div>
  );
};

export default Index;
