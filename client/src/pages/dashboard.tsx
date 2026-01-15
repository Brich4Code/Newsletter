import { useState, useEffect } from "react";
import { AgentCard } from "@/components/newsroom/AgentStatus";
import { PipelineBoard } from "@/components/newsroom/PipelineBoard";
import { LogTerminal } from "@/components/newsroom/LogTerminal";
import { MOCK_AGENTS, MOCK_LOGS, MOCK_STORIES, Agent, LogEntry, Story, cn } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Play, Plus, RefreshCw, Settings2 } from "lucide-react";
import logoImage from "@assets/generated_images/minimalist_geometric_logo_for_hello_jumble_ai_newsroom.png";

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>(MOCK_AGENTS);
  const [stories, setStories] = useState<Story[]>(MOCK_STORIES);
  const [logs, setLogs] = useState<LogEntry[]>(MOCK_LOGS);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);

  // Simulate live updates
  useEffect(() => {
    if (!isPipelineRunning) return;

    const interval = setInterval(() => {
      // Randomly update an agent's status
      setAgents(prev => prev.map(agent => {
        if (Math.random() > 0.7) {
          const tasks = [
            'Analyzing sentiment...', 
            'Cross-referencing sources...', 
            'Generating summary...', 
            'Checking compliance rules...',
            'Optimizing SEO headers...'
          ];
          return {
            ...agent,
            status: Math.random() > 0.8 ? 'idle' : 'working',
            currentTask: Math.random() > 0.5 ? tasks[Math.floor(Math.random() * tasks.length)] : agent.currentTask
          };
        }
        return agent;
      }));

      // Randomly add a log
      if (Math.random() > 0.6) {
        const newLog: LogEntry = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          level: Math.random() > 0.9 ? 'warn' : 'info',
          source: ['ScoopHunter', 'Writer', 'Orchestrator'][Math.floor(Math.random() * 3)],
          message: `Processed batch #${Math.floor(Math.random() * 1000)}`
        };
        setLogs(prev => [...prev.slice(-50), newLog]);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isPipelineRunning]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20">
      {/* Header */}
      <header className="h-14 border-b border-border/40 bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary/10 p-1">
             <img src={logoImage} alt="Logo" className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal opacity-90" />
          </div>
          <h1 className="font-display font-bold text-lg tracking-tight">
            Hello Jumble <span className="text-muted-foreground font-normal text-sm ml-1">Newsroom OS v0.9</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-4 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full border border-border/50">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            System Online
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-2">
            <Settings2 className="w-3.5 h-3.5" />
            Config
          </Button>
          <Button 
            size="sm" 
            className={isPipelineRunning ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90"}
            onClick={() => setIsPipelineRunning(!isPipelineRunning)}
          >
            {isPipelineRunning ? <PowerIcon className="w-3.5 h-3.5 mr-2" /> : <Play className="w-3.5 h-3.5 mr-2" />}
            {isPipelineRunning ? "Stop Pipeline" : "Run Pipeline"}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 grid grid-cols-12 gap-6 overflow-hidden max-h-[calc(100vh-56px)]">
        
        {/* Left Sidebar: Agents */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Active Agents</h2>
            <Button variant="ghost" size="icon" className="h-6 w-6"><RefreshCw className="w-3 h-3" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 pb-4">
            {agents.map(agent => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>

        {/* Center: Pipeline */}
        <div className="col-span-6 flex flex-col gap-4 min-h-0">
          <div className="flex items-center justify-between">
             <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Editorial Pipeline</h2>
             <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
               <Plus className="w-3 h-3" /> New Story
             </Button>
          </div>
          <div className="flex-1 min-h-0 bg-background rounded-xl border border-border/40 relative">
             <PipelineBoard stories={stories} />
             {/* Gradient fade on right */}
             <div className="absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Right Sidebar: Logs & Metrics */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0">
           <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">System Output</h2>
           <div className="flex-1 min-h-0">
             <LogTerminal logs={logs} />
           </div>
           <div className="h-1/3 bg-muted/20 rounded-xl border border-border/40 p-4 flex flex-col">
             <h3 className="text-xs font-semibold mb-3">Today's Metrics</h3>
             <div className="grid grid-cols-2 gap-4 flex-1">
                <MetricBox label="Stories Published" value="12" change="+20%" />
                <MetricBox label="Avg. Generation" value="45s" change="-5%" good />
                <MetricBox label="Source Accuracy" value="98.2%" change="+0.1%" good />
                <MetricBox label="API Cost" value="$4.20" change="+12%" bad />
             </div>
           </div>
        </div>

      </main>
    </div>
  );
}

function MetricBox({ label, value, change, good, bad }: { label: string, value: string, change: string, good?: boolean, bad?: boolean }) {
  return (
    <div className="flex flex-col justify-center">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-display font-bold">{value}</span>
        <span className={cn(
          "text-[10px]", 
          good ? "text-emerald-500" : bad ? "text-red-500" : "text-muted-foreground"
        )}>
          {change}
        </span>
      </div>
    </div>
  );
}

function PowerIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
      <line x1="12" y1="2" x2="12" y2="12"></line>
    </svg>
  );
}
