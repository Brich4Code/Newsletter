import { Story, cn } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { FileText, MoreHorizontal } from "lucide-react";

interface PipelineBoardProps {
  stories: Story[];
}

const COLUMNS: { id: Story['status']; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'researching', label: 'Researching' },
  { id: 'drafting', label: 'Drafting' },
  { id: 'review', label: 'Review' },
  { id: 'published', label: 'Published' },
];

export function PipelineBoard({ stories }: PipelineBoardProps) {
  return (
    <div className="h-full overflow-x-auto">
      <div className="flex gap-4 h-full min-w-[1000px] p-1">
        {COLUMNS.map((col) => {
          const colStories = stories.filter(s => s.status === col.id);
          
          return (
            <div key={col.id} className="flex-1 min-w-[200px] flex flex-col gap-3">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  {col.label}
                </h3>
                <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full">
                  {colStories.length}
                </span>
              </div>
              
              <div className="flex-1 bg-muted/30 rounded-xl p-2 border border-border/40">
                <ScrollArea className="h-[calc(100vh-280px)]">
                  <div className="flex flex-col gap-2">
                    {colStories.map((story) => (
                      <StoryCard key={story.id} story={story} />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StoryCard({ story }: { story: Story }) {
  return (
    <motion.div
      layoutId={story.id}
      className="bg-card hover:bg-card/80 p-3 rounded-lg border border-border/50 shadow-sm cursor-pointer group transition-all"
    >
      <div className="flex justify-between items-start mb-2">
        <Badge 
          variant="outline" 
          className={cn(
            "text-[10px] px-1 py-0 h-4 border-0",
            story.priority === 'high' ? "bg-red-500/10 text-red-500" :
            story.priority === 'medium' ? "bg-orange-500/10 text-orange-500" :
            "bg-blue-500/10 text-blue-500"
          )}
        >
          {story.priority}
        </Badge>
        <button className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
      
      <h4 className="text-sm font-medium leading-snug mb-2 font-display">
        {story.title}
      </h4>
      
      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
        {story.summary}
      </p>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/50 pt-2">
        <div className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          <span>{story.sources?.length || 0} src</span>
        </div>
        {story.assignedAgent && (
          <span className="font-mono bg-muted px-1 rounded">
            @{story.assignedAgent}
          </span>
        )}
      </div>
    </motion.div>
  );
}
