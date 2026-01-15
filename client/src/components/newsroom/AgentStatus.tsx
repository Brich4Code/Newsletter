import { motion } from "framer-motion";
import { Activity, AlertCircle, CheckCircle2, Power, Zap } from "lucide-react";
import { Agent, cn } from "@/lib/mock-data";

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  const isWorking = agent.status === 'working';
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative overflow-hidden rounded-xl border p-4 transition-all hover:shadow-md bg-card/50 backdrop-blur-sm",
        agent.status === 'working' ? "border-primary/50 shadow-[0_0_15px_rgba(249,115,22,0.1)]" : "border-border/50",
        agent.status === 'error' && "border-destructive/50 bg-destructive/5"
      )}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-2 rounded-lg",
            agent.status === 'working' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            agent.status === 'error' && "bg-destructive/10 text-destructive"
          )}>
            {agent.role === 'Discovery' && <Zap className="w-4 h-4" />}
            {agent.role === 'Research' && <Activity className="w-4 h-4" />}
            {agent.role === 'Content Gen' && <CheckCircle2 className="w-4 h-4" />}
            {agent.role === 'Review' && <AlertCircle className="w-4 h-4" />}
            {agent.role === 'Assets' && <Power className="w-4 h-4" />}
            {agent.role === 'Safety' && <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="font-medium text-sm text-foreground">{agent.name}</h3>
            <p className="text-xs text-muted-foreground">{agent.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "relative flex h-2 w-2 rounded-full",
            agent.status === 'working' && "animate-pulse bg-primary",
            agent.status === 'idle' && "bg-emerald-500",
            agent.status === 'error' && "bg-destructive",
            agent.status === 'offline' && "bg-muted-foreground"
          )} />
          <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
            {agent.status}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Current Task</span>
          <span>{agent.efficiency}% Eff</span>
        </div>
        <div className="h-10 text-xs font-mono text-foreground/80 leading-relaxed bg-black/20 rounded p-2 overflow-hidden text-ellipsis">
          {agent.currentTask || "Waiting for tasks..."}
        </div>
        
        {/* Progress Bar Simulation */}
        {isWorking && (
          <div className="h-1 w-full bg-muted overflow-hidden rounded-full">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
