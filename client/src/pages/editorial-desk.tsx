import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchLeads, fetchChallenges, generateChallenges, publishIssue, startResearch, deleteLead, deleteAllLeads } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { Lead, Challenge } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, ExternalLink, FileText, Layout, RefreshCw, Trash2, Trophy, Newspaper, Database, Loader2, Shuffle } from "lucide-react";
import logoImage from "@assets/generated_images/happy_colorful_playful_geometric_logo_for_hello_jumble.png";
import { toast } from "@/hooks/use-toast";

export default function EditorialDesk() {
  const [selectedMain, setSelectedMain] = useState<Lead | null>(null);
  const [selectedSecondary, setSelectedSecondary] = useState<Lead | null>(null);
  const [selectedLinks, setSelectedLinks] = useState<Lead[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);

  // Fetch leads from API
  const { data: leads = [], isLoading: leadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ["leads"],
    queryFn: fetchLeads,
  });

  // Fetch challenges from API
  const { data: challenges = [], isLoading: challengesLoading } = useQuery({
    queryKey: ["challenges"],
    queryFn: fetchChallenges,
  });

  // Research mutation
  const researchMutation = useMutation({
    mutationFn: startResearch,
    onSuccess: () => {
      toast({
        title: "Research Started!",
        description: "Agents are finding stories. Refresh in 2-5 minutes to see new leads.",
      });
      // Refetch leads after a delay to show new results
      setTimeout(() => {
        refetchLeads();
      }, 120000); // 2 minutes
    },
    onError: () => {
      toast({
        title: "Research Failed",
        description: "There was an error starting research. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: publishIssue,
    onSuccess: (issue) => {
      toast({
        title: "Issue Published!",
        description: `Issue #${issue.issueNumber} has been saved to the database.`,
      });

      // Reset selections after publishing
      setSelectedMain(null);
      setSelectedSecondary(null);
      setSelectedLinks([]);
      setSelectedChallenge(null);
    },
    onError: () => {
      toast({
        title: "Publishing Failed",
        description: "There was an error publishing the issue. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete lead mutation
  const deleteLeadMutation = useMutation({
    mutationFn: deleteLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "Lead Deleted",
        description: "The story has been removed from your list.",
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Couldn't delete the lead. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Clear all leads mutation
  const clearAllLeadsMutation = useMutation({
    mutationFn: deleteAllLeads,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      // Clear all selections
      setSelectedMain(null);
      setSelectedSecondary(null);
      setSelectedLinks([]);
      toast({
        title: "All Leads Cleared",
        description: `Removed ${result.count} leads from the database.`,
      });
    },
    onError: () => {
      toast({
        title: "Clear Failed",
        description: "Couldn't clear leads. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Generate challenges mutation
  const generateChallengesMutation = useMutation({
    mutationFn: generateChallenges,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
      setSelectedChallenge(null); // Clear selection since options changed
      toast({
        title: "New Challenges Ready",
        description: `Generated ${data.challenges.length} new options.`,
      });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Couldn't generate new challenges. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteLead = (lead: Lead) => {
    // Remove from selections if selected
    if (selectedMain?.id === lead.id) setSelectedMain(null);
    if (selectedSecondary?.id === lead.id) setSelectedSecondary(null);
    setSelectedLinks(prev => prev.filter(l => l.id !== lead.id));
    // Delete from database
    deleteLeadMutation.mutate(lead.id);
  };

  const handlePublish = () => {
    if (!selectedMain) {
      toast({
        title: "Missing Main Story",
        description: "Please select a main story before publishing.",
        variant: "destructive",
      });
      return;
    }

    publishMutation.mutate({
      issueNumber: 0, // Will be auto-incremented by the server
      mainStoryId: selectedMain.id,
      secondaryStoryId: selectedSecondary?.id || null,
      challengeId: selectedChallenge?.id || null,
      quickLinkIds: selectedLinks.map(l => l.id),
      googleDocsUrl: null,
    });
  };

  const assignMain = (lead: Lead) => {
    if (selectedSecondary?.id === lead.id) setSelectedSecondary(null);
    setSelectedLinks(prev => prev.filter(l => l.id !== lead.id));
    setSelectedMain(lead);
  };

  const assignSecondary = (lead: Lead) => {
    if (selectedMain?.id === lead.id) setSelectedMain(null);
    setSelectedLinks(prev => prev.filter(l => l.id !== lead.id));
    setSelectedSecondary(lead);
  };

  const toggleLink = (lead: Lead) => {
    if (selectedMain?.id === lead.id) setSelectedMain(null);
    if (selectedSecondary?.id === lead.id) setSelectedSecondary(null);

    if (selectedLinks.find(l => l.id === lead.id)) {
      setSelectedLinks(prev => prev.filter(l => l.id !== lead.id));
    } else {
      setSelectedLinks(prev => [...prev, lead]);
    }
  };

  const isSelected = (id: string) => {
    return selectedMain?.id === id || selectedSecondary?.id === id || selectedLinks.find(l => l.id === id);
  };

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden font-sans selection:bg-primary/20">

      {/* Header */}
      <header className="h-16 border-b border-border/40 bg-background/50 backdrop-blur sticky top-0 z-50 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary/10 p-1">
            <img src={logoImage} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg tracking-tight leading-none">Editorial Desk</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Hello Jumble Newsroom</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 mr-2 text-xs text-muted-foreground bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/30">
            <Database className="w-3 h-3 text-emerald-500" />
            <span className="text-emerald-500 font-medium">Database Connected</span>
          </div>
          <div className="flex flex-col items-end mr-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Completeness</span>
            <div className="flex gap-1 mt-1">
              <div className={cn("w-8 h-1 rounded-full", selectedMain ? "bg-primary" : "bg-muted")}></div>
              <div className={cn("w-8 h-1 rounded-full", selectedSecondary ? "bg-primary" : "bg-muted")}></div>
              <div className={cn("w-8 h-1 rounded-full", selectedLinks.length > 2 ? "bg-primary" : "bg-muted")}></div>
              <div className={cn("w-8 h-1 rounded-full", selectedChallenge ? "bg-primary" : "bg-muted")}></div>
            </div>
          </div>
          <Button
            size="lg"
            className="rounded-full px-8 shadow-lg shadow-primary/20"
            onClick={handlePublish}
            disabled={publishMutation.isPending || !selectedMain}
          >
            {publishMutation.isPending ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                Publish Issue <ArrowRight className="ml-2 w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">

        {/* Column 1: The Wire (Source Material) */}
        <aside className="w-[400px] border-r border-border/40 bg-muted/10 flex flex-col shrink-0">
          <div className="p-4 border-b border-border/40 bg-background/50 backdrop-blur z-10 flex justify-between items-center sticky top-0">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
              Incoming Wire
              <Badge variant="secondary" className="ml-2 text-[10px] h-5">{leads.length} Leads</Badge>
            </h2>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchLeads()}
                disabled={leadsLoading}
              >
                {leadsLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearAllLeadsMutation.mutate()}
                disabled={clearAllLeadsMutation.isPending || leads.length === 0}
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                {clearAllLeadsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 w-3 h-3 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-1 w-3 h-3" />
                    Clear All
                  </>
                )}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => researchMutation.mutate()}
                disabled={researchMutation.isPending}
                className="bg-primary text-primary-foreground"
              >
                {researchMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 w-3 h-3 animate-spin" />
                    Finding...
                  </>
                ) : (
                  "Find Stories"
                )}
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            {leadsLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                Loading leads...
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {leads.map(lead => (
                  <div
                    key={lead.id}
                    className={cn(
                      "group relative p-4 rounded-xl border transition-all duration-200 bg-card hover:shadow-md",
                      isSelected(lead.id) ? "border-primary/50 bg-primary/5" : "border-border/50 hover:border-primary/20"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {lead.source}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{lead.relevanceScore}% Match</span>
                    </div>

                    <h3 className="font-display font-medium text-sm leading-snug mb-2 text-foreground/90">
                      {lead.title}
                    </h3>

                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                      {lead.summary}
                    </p>

                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] hover:bg-primary hover:text-primary-foreground"
                        onClick={() => assignMain(lead)}
                        disabled={selectedMain?.id === lead.id}
                      >
                        Main
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] hover:bg-primary hover:text-primary-foreground"
                        onClick={() => assignSecondary(lead)}
                        disabled={selectedSecondary?.id === lead.id}
                      >
                        Secondary
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] hover:bg-primary hover:text-primary-foreground"
                        onClick={() => toggleLink(lead)}
                      >
                        {selectedLinks.find(l => l.id === lead.id) ? "Remove" : "Link"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleDeleteLead(lead)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>

                    {isSelected(lead.id) && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </aside>

        {/* Column 2: The Issue (Drafting) */}
        <main className="flex-1 flex flex-col min-w-0 bg-background overflow-y-auto">
          <div className="p-8 max-w-3xl mx-auto w-full space-y-8">

            <div className="space-y-2">
              <h2 className="text-2xl font-display font-bold tracking-tight">Today's Issue</h2>
              <p className="text-muted-foreground">Curate the stories for the morning briefing.</p>
            </div>

            {/* Main Story Slot */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Layout className="w-4 h-4 text-primary" /> Feature Story
                </label>
                {selectedMain && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-destructive" onClick={() => setSelectedMain(null)}>Clear</Button>
                )}
              </div>

              <div className={cn(
                "rounded-2xl border-2 border-dashed p-8 transition-all min-h-[200px] flex flex-col justify-center items-center text-center relative overflow-hidden",
                selectedMain ? "border-primary/20 bg-card" : "border-border/30 bg-muted/5 hover:bg-muted/10 hover:border-primary/30"
              )}>
                {selectedMain ? (
                  <div className="w-full text-left space-y-4 relative z-10">
                    <Badge className="bg-primary/20 text-primary hover:bg-primary/20 border-0">Feature Story</Badge>
                    <h1 className="text-3xl font-display font-bold">{selectedMain.title}</h1>
                    <p className="text-lg text-muted-foreground leading-relaxed">{selectedMain.summary}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground pt-4 border-t border-border/50 mt-4">
                      <ExternalLink className="w-4 h-4" />
                      <span>Source: {selectedMain.source}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground/40 space-y-2 pointer-events-none">
                    <Newspaper className="w-12 h-12 mx-auto opacity-50" />
                    <p className="font-medium">Select a lead from the wire</p>
                  </div>
                )}
              </div>
            </section>

            <div className="grid grid-cols-2 gap-8">

              {/* Secondary Story Slot */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" /> Secondary Story
                  </label>
                  {selectedSecondary && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-destructive" onClick={() => setSelectedSecondary(null)}>Clear</Button>
                  )}
                </div>

                <div className={cn(
                  "rounded-xl border-2 border-dashed p-6 transition-all min-h-[150px] flex flex-col justify-center items-center text-center relative h-full",
                  selectedSecondary ? "border-primary/20 bg-card" : "border-border/30 bg-muted/5 hover:bg-muted/10 hover:border-primary/30"
                )}>
                  {selectedSecondary ? (
                    <div className="w-full text-left space-y-2 relative z-10">
                      <Badge variant="secondary" className="mb-2">Must Read</Badge>
                      <h3 className="text-lg font-bold leading-tight">{selectedSecondary.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-3">{selectedSecondary.summary}</p>
                    </div>
                  ) : (
                    <div className="text-muted-foreground/40 space-y-1 pointer-events-none">
                      <p className="text-sm font-medium">Select secondary</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Weekly Challenge Slot */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-primary" /> Weekly Challenge
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground hover:text-primary"
                    onClick={() => generateChallengesMutation.mutate()}
                    disabled={generateChallengesMutation.isPending}
                  >
                    {generateChallengesMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Shuffle className="w-3 h-3 mr-1" />
                    )}
                    Shuffle Options
                  </Button>
                </div>

                {challengesLoading || generateChallengesMutation.isPending ? (
                  <div className="rounded-xl border border-border/50 bg-card p-4 text-center min-h-[200px] flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-xs text-muted-foreground mt-2">Generating new challenges...</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3 min-h-[200px]">
                    {challenges.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm flex flex-col items-center justify-center h-full">
                        <Trophy className="w-8 h-8 text-muted-foreground/30 mb-2" />
                        <p>No challenges available.</p>
                        <p className="text-xs mt-1">Click Shuffle to generate.</p>
                      </div>
                    ) : (
                      challenges.map(challenge => (
                        <div
                          key={challenge.id}
                          onClick={() => setSelectedChallenge(challenge)}
                          className={cn(
                            "p-3 rounded-lg cursor-pointer border transition-all hover:shadow-sm",
                            selectedChallenge?.id === challenge.id
                              ? "bg-primary/10 border-primary shadow-sm"
                              : "bg-background border-border/50 hover:border-primary/30"
                          )}
                        >
                          <div className="flex justify-between items-start">
                            <h4 className="text-xs font-bold">{challenge.title}</h4>
                            {selectedChallenge?.id === challenge.id && <Check className="w-3 h-3 text-primary" />}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{challenge.description}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </section>
            </div>

            {/* Quick Links Section */}
            <section className="space-y-3 pt-4">
              <label className="text-sm font-medium flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-primary" /> Quick Hits ({selectedLinks.length})
              </label>
              <div className="grid grid-cols-1 gap-2">
                {selectedLinks.length === 0 && (
                  <div className="text-center p-8 border border-dashed border-border/40 rounded-xl text-muted-foreground/50 text-sm">
                    Select "Link" on items from the wire to add them here.
                  </div>
                )}
                {selectedLinks.map(link => (
                  <div key={link.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/50">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="font-medium text-sm truncate">{link.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0 border-l border-border/50 pl-3 ml-1">{link.source}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => toggleLink(link)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </section>

          </div>
        </main>

      </div>
    </div>
  );
}
