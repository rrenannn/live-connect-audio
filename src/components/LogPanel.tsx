import { Terminal } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { LogEntry } from '@/hooks/useWebRTC';

interface LogPanelProps {
  logs: LogEntry[];
}

const typeColors: Record<LogEntry['type'], string> = {
  info: 'text-blue-400',
  success: 'text-emerald-400',
  error: 'text-red-400',
  warning: 'text-amber-400',
};

export function LogPanel({ logs }: LogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
          <Terminal className="h-5 w-5 text-secondary-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">Logs</h2>
          <p className="text-sm text-muted-foreground">{logs.length} entradas</p>
        </div>
      </div>

      <div ref={scrollRef} className="terminal-log h-64 overflow-y-auto p-4 text-sm leading-relaxed">
        {logs.length === 0 ? (
          <p className="terminal-log-muted">Aguardando eventos...</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className="terminal-log-muted shrink-0">{log.time}</span>
              <span className={typeColors[log.type]}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
