import { LogEntry, cn } from "@/lib/mock-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef } from "react";

interface LogTerminalProps {
  logs: LogEntry[];
}

export function LogTerminal({ logs }: LogTerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-[#0d1117] rounded-xl border border-border/50 overflow-hidden font-mono text-xs">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 border-b border-border/20">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50" />
        </div>
        <span className="ml-2 text-muted-foreground/70">system.log</span>
      </div>
      
      <ScrollArea ref={scrollRef} className="flex-1 p-3">
        <div className="space-y-1">
          {logs.map((log) => (
            <div key={log.id} className="flex gap-3 hover:bg-white/5 p-0.5 rounded px-1 transition-colors">
              <span className="text-muted-foreground/50 shrink-0 select-none">{log.timestamp}</span>
              <span className={cn(
                "shrink-0 w-24 font-bold",
                log.level === 'info' && "text-blue-400",
                log.level === 'success' && "text-emerald-400",
                log.level === 'warn' && "text-yellow-400",
                log.level === 'error' && "text-red-400",
              )}>
                [{log.source}]
              </span>
              <span className="text-foreground/80 break-all">{log.message}</span>
            </div>
          ))}
          <div className="h-4 w-2 bg-primary/50 animate-pulse mt-1" />
        </div>
      </ScrollArea>
    </div>
  );
}
