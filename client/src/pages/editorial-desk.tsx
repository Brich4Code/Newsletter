import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchLeads, fetchChallenges, generateChallenges, createCustomChallenge, publishIssue, startResearch, startDeepDiveResearch, startMonthlyResearch, startBreakingResearch, deleteLead, deleteAllLeads, createLead, updateLeadNote, fetchResearchStatus } from "@/lib/api";
import type { ResearchStatus } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { Lead, Challenge } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ArrowRight, Check, ExternalLink, FileText, Layout, RefreshCw, Trash2, Trophy, Newspaper, Database, Loader2, Shuffle, Plus, StickyNote, Menu, X, PenLine, LogOut, Calendar, Search, ChevronDown, Zap, TrendingUp } from "lucide-react";
import logoImage from "@assets/generated_images/happy_colorful_playful_geometric_logo_for_hello_jumble.png";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/App";
import { Link } from "wouter";

export default function EditorialDesk() {
  const { user, logout } = useAuth();
  const [selectedMain, setSelectedMain] = useState<Lead | null>(null);
  const [selectedSecondary, setSelectedSecondary] = useState<Lead | null>(null);
  const [selectedLinks, setSelectedLinks] = useState<Lead[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Add Story dialog state
  const [addStoryOpen, setAddStoryOpen] = useState(false);
  const [newStory, setNewStory] = useState({
    title: "",
    source: "",
    url: "",
    summary: "",
    note: "",
  });

  // Notes for selected stories
  const [mainNote, setMainNote] = useState("");
  const [secondaryNote, setSecondaryNote] = useState("");

  // Custom challenge dialog state
  const [customChallengeOpen, setCustomChallengeOpen] = useState(false);
  const [customChallengePrompt, setCustomChallengePrompt] = useState("");

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  // Research polling state
  const [isResearching, setIsResearching] = useState(false);

  // Poll research status every 10s while researching (keeps HTTP traffic alive to prevent SIGTERM)
  const { data: researchStatus } = useQuery<ResearchStatus>({
    queryKey: ["researchStatus"],
    queryFn: fetchResearchStatus,
    refetchInterval: isResearching ? 10000 : false,
    enabled: isResearching,
  });

  // Watch for research completion → auto refresh leads
  useEffect(() => {
    if (!researchStatus || !isResearching) return;

    if (researchStatus.status === "completed") {
      setIsResearching(false);
      refetchLeads();
      toast({
        title: "Research Complete!",
        description: `Found ${researchStatus.leadsStored} new leads in ${researchStatus.candidatesFound} candidates.`,
      });
    } else if (researchStatus.status === "failed") {
      setIsResearching(false);
      toast({
        title: "Research Failed",
        description: researchStatus.error || "An unknown error occurred.",
        variant: "destructive",
      });
    }
  }, [researchStatus?.status]);

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
    mutationFn: () => startResearch("standard"),
    onSuccess: () => {
      setIsResearching(true);
      toast({
        title: "Standard Research Started!",
        description: "Reviewing last 7 days of news. You'll see progress below.",
      });
    },
    onError: () => {
      toast({
        title: "Research Failed",
        description: "There was an error starting research. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Deep Dive mutation
  const deepDiveMutation = useMutation({
    mutationFn: startDeepDiveResearch,
    onSuccess: () => {
      setIsResearching(true);
      toast({
        title: "Trend Scout Started!",
        description: "Identifying trends and finding stories. You'll see progress below.",
      });
    },
    onError: () => {
      toast({
        title: "Deep Dive Failed",
        description: "There was an error starting the deep dive. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Monthly Research mutation
  const monthlyMutation = useMutation({
    mutationFn: startMonthlyResearch,
    onSuccess: () => {
      setIsResearching(true);
      toast({
        title: "Monthly Search Started!",
        description: "Searching last 30 days across AI, science, and health. You'll see progress below.",
      });
    },
    onError: () => {
      toast({
        title: "Monthly Search Failed",
        description: "There was an error starting the monthly search. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Breaking News mutation (48 hours)
  const breakingMutation = useMutation({
    mutationFn: startBreakingResearch,
    onSuccess: () => {
      setIsResearching(true);
      toast({
        title: "Breaking News Scan Started!",
        description: "Scanning last 48 hours for trending stories. You'll see progress below.",
      });
    },
    onError: () => {
      toast({
        title: "Breaking News Scan Failed",
        description: "There was an error starting the scan. Please try again.",
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
      setMainNote("");
      setSecondaryNote("");
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
      setMainNote("");
      setSecondaryNote("");
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

  // Create custom challenge mutation
  const createCustomChallengeMutation = useMutation({
    mutationFn: createCustomChallenge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
      setCustomChallengeOpen(false);
      setCustomChallengePrompt("");
      toast({
        title: "Challenge Created",
        description: "Your custom challenge has been generated and added.",
      });
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Couldn't create the challenge. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create lead mutation
  const createLeadMutation = useMutation({
    mutationFn: createLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setAddStoryOpen(false);
      setNewStory({ title: "", source: "", url: "", summary: "", note: "" });
      toast({
        title: "Story Added",
        description: "Your story has been added to the wire.",
      });
    },
    onError: () => {
      toast({
        title: "Add Failed",
        description: "Couldn't add the story. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update lead note mutation
  const updateNoteMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => updateLeadNote(id, note),
    onSuccess: (updatedLead) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      // Update local selection state
      if (selectedMain?.id === updatedLead.id) {
        setSelectedMain(updatedLead);
      }
      if (selectedSecondary?.id === updatedLead.id) {
        setSelectedSecondary(updatedLead);
      }
      toast({
        title: "Note Saved",
        description: "Your editorial note has been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Couldn't save the note. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteLead = (lead: Lead) => {
    // Remove from selections if selected
    if (selectedMain?.id === lead.id) {
      setSelectedMain(null);
      setMainNote("");
    }
    if (selectedSecondary?.id === lead.id) {
      setSelectedSecondary(null);
      setSecondaryNote("");
    }
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

    // Save notes before publishing
    if (mainNote && selectedMain && mainNote !== selectedMain.note) {
      updateNoteMutation.mutate({ id: selectedMain.id, note: mainNote });
    }
    if (secondaryNote && selectedSecondary && secondaryNote !== selectedSecondary.note) {
      updateNoteMutation.mutate({ id: selectedSecondary.id, note: secondaryNote });
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

  const handleAddStory = () => {
    if (!newStory.title || !newStory.url || !newStory.summary) {
      toast({
        title: "Missing Fields",
        description: "Please fill in the title, URL, and summary.",
        variant: "destructive",
      });
      return;
    }
    createLeadMutation.mutate({
      ...newStory,
      source: newStory.source || "Manual Entry",
      isManual: true,
    });
  };

  const assignMain = (lead: Lead) => {
    if (selectedSecondary?.id === lead.id) {
      setSelectedSecondary(null);
      setSecondaryNote("");
    }
    setSelectedLinks(prev => prev.filter(l => l.id !== lead.id));
    setSelectedMain(lead);
    setMainNote(lead.note || "");
    setSidebarOpen(false); // Close sidebar on mobile after selection
  };

  const assignSecondary = (lead: Lead) => {
    if (selectedMain?.id === lead.id) {
      setSelectedMain(null);
      setMainNote("");
    }
    setSelectedLinks(prev => prev.filter(l => l.id !== lead.id));
    setSelectedSecondary(lead);
    setSecondaryNote(lead.note || "");
    setSidebarOpen(false); // Close sidebar on mobile after selection
  };

  const toggleLink = (lead: Lead) => {
    if (selectedMain?.id === lead.id) {
      setSelectedMain(null);
      setMainNote("");
    }
    if (selectedSecondary?.id === lead.id) {
      setSelectedSecondary(null);
      setSecondaryNote("");
    }

    if (selectedLinks.find(l => l.id === lead.id)) {
      setSelectedLinks(prev => prev.filter(l => l.id !== lead.id));
    } else {
      setSelectedLinks(prev => [...prev, lead]);
    }
  };

  const isSelected = (id: string) => {
    return selectedMain?.id === id || selectedSecondary?.id === id || selectedLinks.find(l => l.id === id);
  };

  const handleSaveNote = (type: "main" | "secondary") => {
    const lead = type === "main" ? selectedMain : selectedSecondary;
    const note = type === "main" ? mainNote : secondaryNote;
    if (lead) {
      updateNoteMutation.mutate({ id: lead.id, note });
    }
  };

  // Filter leads based on search and source filter
  const filteredLeads = leads.filter(lead => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        lead.title.toLowerCase().includes(query) ||
        lead.summary.toLowerCase().includes(query) ||
        lead.source.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Source filter
    if (sourceFilter && lead.source !== sourceFilter) {
      return false;
    }

    return true;
  });

  // Get unique sources for filter dropdown
  const uniqueSources = Array.from(new Set(leads.map(lead => lead.source))).sort();

  return (
    <div className="h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-950 dark:to-indigo-950 text-foreground flex flex-col overflow-hidden font-sans selection:bg-primary/20">

      {/* Header */}
      <header className="h-14 md:h-16 border-b border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-xl sticky top-0 z-50 px-4 md:px-6 flex items-center justify-between shrink-0 shadow-lg shadow-black/5">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden p-2"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <div className="w-8 h-8 rounded bg-primary/10 p-1">
            <img src={logoImage} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-display font-bold text-lg tracking-tight leading-none">Editorial Desk</h1>
            <p className="text-xs text-muted-foreground mt-0.5">AI Newsroom</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <Link href="/content">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden lg:inline">Content Library</span>
            </Button>
          </Link>
          <Link href="/editor/new">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <PenLine className="w-4 h-4" />
              <span className="hidden lg:inline">New Draft</span>
            </Button>
          </Link>
          <div className="hidden md:flex items-center gap-2 mr-2 text-xs text-muted-foreground bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/30">
            <Database className="w-3 h-3 text-emerald-500" />
            <span className="text-emerald-500 font-medium">Connected</span>
          </div>
          {user && (
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground"
              onClick={async () => {
                await logout();
                window.location.href = "/login";
              }}
              title={`Logged in as ${user.username}`}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden lg:inline">Logout</span>
            </Button>
          )}
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Progress</span>
            <div className="flex gap-1 mt-1">
              <div className={cn("w-6 md:w-8 h-1 rounded-full", selectedMain ? "bg-primary" : "bg-muted")}></div>
              <div className={cn("w-6 md:w-8 h-1 rounded-full", selectedSecondary ? "bg-primary" : "bg-muted")}></div>
              <div className={cn("w-6 md:w-8 h-1 rounded-full", selectedLinks.length > 2 ? "bg-primary" : "bg-muted")}></div>
              <div className={cn("w-6 md:w-8 h-1 rounded-full", selectedChallenge ? "bg-primary" : "bg-muted")}></div>
            </div>
          </div>
          <Button
            size="sm"
            className="rounded-full px-4 md:px-8 shadow-lg shadow-primary/20"
            onClick={handlePublish}
            disabled={publishMutation.isPending || !selectedMain}
          >
            {publishMutation.isPending ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Publishing...</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Publish Issue</span>
                <span className="sm:hidden">Publish</span>
                <ArrowRight className="ml-1 md:ml-2 w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Column 1: The Wire (Source Material) */}
        <aside className={cn(
          "fixed lg:relative inset-y-0 left-0 z-40 w-[85vw] sm:w-[400px] border-r border-white/20 dark:border-white/10 bg-white/30 dark:bg-black/20 backdrop-blur-xl flex flex-col shrink-0 transition-transform duration-300 lg:transition-none shadow-2xl",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
          {/* Research Progress Banner */}
          {isResearching && researchStatus && researchStatus.status === "running" && (
            <div className="px-3 md:px-4 py-2 border-b border-primary/20 bg-primary/10 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-1">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                <span className="text-xs font-medium text-primary capitalize">
                  {researchStatus.phase || "Starting"}
                  {researchStatus.mode ? ` (${researchStatus.mode})` : ""}
                </span>
              </div>
              {researchStatus.totalQueries > 0 && (
                <div className="w-full bg-primary/20 rounded-full h-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round((researchStatus.completedQueries / researchStatus.totalQueries) * 100)}%`,
                    }}
                  />
                </div>
              )}
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>
                  {researchStatus.completedQueries}/{researchStatus.totalQueries} queries
                </span>
                <span>
                  {researchStatus.candidatesFound} candidates
                </span>
              </div>
            </div>
          )}

          <div className="p-3 md:p-4 border-b border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/30 backdrop-blur-xl z-10 sticky top-0">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
                Incoming Wire
                <Badge variant="secondary" className="ml-1 text-[10px] h-5">{filteredLeads.length}/{leads.length}</Badge>
              </h2>
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
            </div>

            {/* Search Bar */}
            <div className="mb-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search stories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm bg-white/60 dark:bg-black/30"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>

            {/* Source Filter */}
            {uniqueSources.length > 1 && (
              <div className="mb-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between text-xs">
                      <span>{sourceFilter || "All Sources"}</span>
                      <ChevronDown className="w-3 h-3 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[340px] max-h-[300px] overflow-y-auto">
                    <DropdownMenuItem onClick={() => setSourceFilter(null)}>
                      All Sources ({leads.length})
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {uniqueSources.map(source => (
                      <DropdownMenuItem
                        key={source}
                        onClick={() => setSourceFilter(source)}
                        className={sourceFilter === source ? "bg-primary/10" : ""}
                      >
                        {source} ({leads.filter(l => l.source === source).length})
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {/* Add Story Dialog */}
              <Dialog open={addStoryOpen} onOpenChange={setAddStoryOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                  >
                    <Plus className="mr-1 w-3 h-3" />
                    Add Story
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Story Manually</DialogTitle>
                    <DialogDescription>
                      Add a story or link that the scanner didn't catch.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        placeholder="Story headline"
                        value={newStory.title}
                        onChange={(e) => setNewStory({ ...newStory, title: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="url">URL *</Label>
                      <Input
                        id="url"
                        type="url"
                        placeholder="https://..."
                        value={newStory.url}
                        onChange={(e) => setNewStory({ ...newStory, url: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="source">Source</Label>
                      <Input
                        id="source"
                        placeholder="e.g., TechCrunch, NYTimes (optional)"
                        value={newStory.source}
                        onChange={(e) => setNewStory({ ...newStory, source: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="summary">Summary *</Label>
                      <Textarea
                        id="summary"
                        placeholder="Brief description of the story..."
                        rows={3}
                        value={newStory.summary}
                        onChange={(e) => setNewStory({ ...newStory, summary: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="note" className="flex items-center gap-2">
                        <StickyNote className="w-3 h-3" />
                        Editorial Note (optional)
                      </Label>
                      <Textarea
                        id="note"
                        placeholder="Notes to guide the LLM when writing about this story..."
                        rows={2}
                        value={newStory.note}
                        onChange={(e) => setNewStory({ ...newStory, note: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddStoryOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddStory} disabled={createLeadMutation.isPending}>
                      {createLeadMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 w-4 h-4" />
                          Add Story
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={researchMutation.isPending || deepDiveMutation.isPending || monthlyMutation.isPending || breakingMutation.isPending}
                    className="bg-primary text-primary-foreground flex-1"
                  >
                    {(researchMutation.isPending || deepDiveMutation.isPending || monthlyMutation.isPending || breakingMutation.isPending) ? (
                      <>
                        <Loader2 className="mr-1 w-3 h-3 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Newspaper className="mr-1 w-3 h-3" />
                        Find Stories
                        <ChevronDown className="ml-1 w-3 h-3" />
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[200px]">
                  <DropdownMenuItem onClick={() => researchMutation.mutate()}>
                    <Newspaper className="mr-2 w-4 h-4" />
                    <div>
                      <div className="font-medium">Standard (7d)</div>
                      <div className="text-[10px] text-muted-foreground">Last week's stories</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => breakingMutation.mutate()}>
                    <Zap className="mr-2 w-4 h-4 text-rose-600" />
                    <div>
                      <div className="font-medium">Breaking (48h)</div>
                      <div className="text-[10px] text-muted-foreground">Ultra-recent trending</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => deepDiveMutation.mutate()}>
                    <Trophy className="mr-2 w-4 h-4 text-indigo-600" />
                    <div>
                      <div className="font-medium">Trend Scout</div>
                      <div className="text-[10px] text-muted-foreground">AI-powered insights</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => monthlyMutation.mutate()}>
                    <Calendar className="mr-2 w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="font-medium">Last 30 Days</div>
                      <div className="text-[10px] text-muted-foreground">Comprehensive search</div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearAllLeadsMutation.mutate()}
                disabled={clearAllLeadsMutation.isPending || leads.length === 0}
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                {clearAllLeadsMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
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
            ) : leads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No stories yet</p>
                <p className="text-sm mt-1">Click "Find Stories" or add one manually</p>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No matching stories</p>
                <p className="text-sm mt-1">Try adjusting your search or filter</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setSearchQuery("");
                    setSourceFilter(null);
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="p-3 md:p-4 space-y-3 min-w-0">
                {filteredLeads.map(lead => (
                  <div
                    key={lead.id}
                    className={cn(
                      "group relative p-3 md:p-4 rounded-xl border transition-all duration-200 bg-white/60 dark:bg-black/30 backdrop-blur-lg hover:shadow-xl hover:shadow-primary/10 overflow-hidden min-w-0",
                      isSelected(lead.id) ? "border-primary/50 bg-primary/20 dark:bg-primary/10 shadow-lg shadow-primary/20" : "border-white/30 dark:border-white/10 hover:border-primary/30"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded truncate max-w-[200px]" title={lead.source}>
                          {lead.source}
                        </span>
                        {lead.isManual && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 whitespace-nowrap">Manual</Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{lead.relevanceScore}%</span>
                    </div>

                    <h3 className="font-display font-medium text-sm leading-snug mb-2 text-foreground/90 break-words overflow-wrap-anywhere w-full">
                      {lead.title}
                    </h3>

                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-2 break-words overflow-wrap-anywhere w-full">
                      {lead.summary}
                    </p>

                    {lead.note && (
                      <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded mb-2 flex items-start gap-1 w-full">
                        <StickyNote className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className="line-clamp-1 break-words overflow-wrap-anywhere flex-1 min-w-0">{lead.note}</span>
                      </div>
                    )}

                    <div className="flex gap-1 flex-wrap justify-end mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] hover:bg-primary hover:text-primary-foreground whitespace-nowrap"
                        onClick={() => assignMain(lead)}
                        disabled={selectedMain?.id === lead.id}
                      >
                        Main
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] hover:bg-primary hover:text-primary-foreground whitespace-nowrap"
                        onClick={() => assignSecondary(lead)}
                        disabled={selectedSecondary?.id === lead.id}
                      >
                        Secondary
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] hover:bg-primary hover:text-primary-foreground whitespace-nowrap"
                        onClick={() => toggleLink(lead)}
                      >
                        {selectedLinks.find(l => l.id === lead.id) ? "Remove" : "Link"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] hover:bg-destructive hover:text-destructive-foreground"
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
          <div className="p-4 md:p-8 max-w-3xl mx-auto w-full space-y-6 md:space-y-8">

            <div className="space-y-2">
              <h2 className="text-xl md:text-2xl font-display font-bold tracking-tight">Today's Issue</h2>
              <p className="text-sm text-muted-foreground">Curate the stories for the morning briefing.</p>
            </div>

            {/* Main Story Slot */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Layout className="w-4 h-4 text-primary" /> Feature Story
                </label>
                {selectedMain && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-destructive" onClick={() => { setSelectedMain(null); setMainNote(""); }}>Clear</Button>
                )}
              </div>

              <div className={cn(
                "rounded-2xl border-2 border-dashed p-4 md:p-8 transition-all min-h-[150px] md:min-h-[200px] flex flex-col justify-center items-center text-center relative overflow-hidden backdrop-blur-lg",
                selectedMain ? "border-primary/30 bg-white/60 dark:bg-black/30 shadow-xl shadow-primary/10" : "border-white/30 dark:border-white/10 bg-white/30 dark:bg-black/20 hover:bg-white/40 dark:hover:bg-black/25 hover:border-primary/40"
              )}>
                {selectedMain ? (
                  <div className="w-full text-left space-y-3 md:space-y-4 relative z-10">
                    <Badge className="bg-primary/20 text-primary hover:bg-primary/20 border-0">Feature Story</Badge>
                    <h1 className="text-xl md:text-3xl font-display font-bold">{selectedMain.title}</h1>
                    <p className="text-sm md:text-lg text-muted-foreground leading-relaxed">{selectedMain.summary}</p>
                    <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground pt-3 md:pt-4 border-t border-border/50 mt-3 md:mt-4">
                      <ExternalLink className="w-4 h-4" />
                      <span>Source: {selectedMain.source}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground/40 space-y-2 pointer-events-none">
                    <Newspaper className="w-10 md:w-12 h-10 md:h-12 mx-auto opacity-50" />
                    <p className="font-medium text-sm md:text-base">Select a lead from the wire</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 lg:hidden pointer-events-auto"
                      onClick={() => setSidebarOpen(true)}
                    >
                      <Menu className="w-4 h-4 mr-2" />
                      Open Wire
                    </Button>
                  </div>
                )}
              </div>

              {/* Note for Main Story */}
              {selectedMain && (
                <div className="space-y-2 bg-amber-100/60 dark:bg-amber-950/30 border border-amber-300/40 dark:border-amber-700/30 rounded-lg p-3 md:p-4 backdrop-blur-lg shadow-lg">
                  <Label className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <PenLine className="w-4 h-4" />
                    Editorial Note for LLM
                  </Label>
                  <Textarea
                    placeholder="Add notes to guide the LLM when writing about this story... (e.g., 'Focus on the impact for small businesses' or 'Mention the connection to last week's story')"
                    rows={2}
                    value={mainNote}
                    onChange={(e) => setMainNote(e.target.value)}
                    className="bg-white dark:bg-background"
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSaveNote("main")}
                      disabled={updateNoteMutation.isPending || mainNote === (selectedMain.note || "")}
                    >
                      {updateNoteMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Check className="w-3 h-3 mr-1" />
                      )}
                      Save Note
                    </Button>
                  </div>
                </div>
              )}
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">

              {/* Secondary Story Slot */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" /> Secondary Story
                  </label>
                  {selectedSecondary && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-destructive" onClick={() => { setSelectedSecondary(null); setSecondaryNote(""); }}>Clear</Button>
                  )}
                </div>

                <div className={cn(
                  "rounded-xl border-2 border-dashed p-4 md:p-6 transition-all min-h-[120px] md:min-h-[150px] flex flex-col justify-center items-center text-center relative backdrop-blur-lg",
                  selectedSecondary ? "border-primary/30 bg-white/60 dark:bg-black/30 shadow-xl shadow-primary/10" : "border-white/30 dark:border-white/10 bg-white/30 dark:bg-black/20 hover:bg-white/40 dark:hover:bg-black/25 hover:border-primary/40"
                )}>
                  {selectedSecondary ? (
                    <div className="w-full text-left space-y-2 relative z-10">
                      <Badge variant="secondary" className="mb-2">Must Read</Badge>
                      <h3 className="text-base md:text-lg font-bold leading-tight">{selectedSecondary.title}</h3>
                      <p className="text-xs md:text-sm text-muted-foreground line-clamp-3">{selectedSecondary.summary}</p>
                    </div>
                  ) : (
                    <div className="text-muted-foreground/40 space-y-1 pointer-events-none">
                      <p className="text-sm font-medium">Select secondary</p>
                    </div>
                  )}
                </div>

                {/* Note for Secondary Story */}
                {selectedSecondary && (
                  <div className="space-y-2 bg-amber-100/60 dark:bg-amber-950/30 border border-amber-300/40 dark:border-amber-700/30 rounded-lg p-3 backdrop-blur-lg shadow-lg">
                    <Label className="text-xs font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <PenLine className="w-3 h-3" />
                      Editorial Note
                    </Label>
                    <Textarea
                      placeholder="Notes to guide the LLM..."
                      rows={2}
                      value={secondaryNote}
                      onChange={(e) => setSecondaryNote(e.target.value)}
                      className="bg-white dark:bg-background text-xs"
                    />
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleSaveNote("secondary")}
                        disabled={updateNoteMutation.isPending || secondaryNote === (selectedSecondary.note || "")}
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </section>

              {/* Weekly Challenge Slot */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-primary" /> Weekly Challenge
                  </label>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground hover:text-primary"
                      onClick={() => setCustomChallengeOpen(true)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Custom
                    </Button>
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
                      Shuffle
                    </Button>
                  </div>
                </div>

                {challengesLoading || generateChallengesMutation.isPending ? (
                  <div className="rounded-xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-lg p-4 text-center min-h-[150px] md:min-h-[200px] flex flex-col items-center justify-center shadow-lg">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-xs text-muted-foreground mt-2">Generating...</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-lg p-3 md:p-4 space-y-2 md:space-y-3 min-h-[150px] md:min-h-[200px] shadow-lg">
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
                            "p-2 md:p-3 rounded-lg cursor-pointer border transition-all backdrop-blur-md",
                            selectedChallenge?.id === challenge.id
                              ? "bg-primary/20 dark:bg-primary/10 border-primary shadow-lg shadow-primary/20"
                              : "bg-white/50 dark:bg-black/30 border-white/40 dark:border-white/10 hover:border-primary/40 hover:shadow-md"
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

                {/* Custom Challenge Dialog */}
                <Dialog open={customChallengeOpen} onOpenChange={setCustomChallengeOpen}>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Generate Custom Challenge</DialogTitle>
                      <DialogDescription>
                        Describe what you want the challenge to be about, and AI will generate a complete challenge.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="challenge-prompt">Challenge Prompt *</Label>
                        <Textarea
                          id="challenge-prompt"
                          placeholder="e.g., Create a challenge about using AI to plan healthy meals for a week"
                          value={customChallengePrompt}
                          onChange={(e) => setCustomChallengePrompt(e.target.value)}
                          rows={4}
                        />
                        <p className="text-xs text-muted-foreground">
                          AI will generate a complete challenge with title, description, and steps using the latest AI tools.
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setCustomChallengeOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => createCustomChallengeMutation.mutate(customChallengePrompt)}
                        disabled={!customChallengePrompt.trim() || createCustomChallengeMutation.isPending}
                      >
                        {createCustomChallengeMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Generating...
                          </>
                        ) : (
                          <>Generate Challenge</>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </section>
            </div>

            {/* Quick Links Section */}
            <section className="space-y-3 pt-2 md:pt-4">
              <label className="text-sm font-medium flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-primary" /> Quick Hits ({selectedLinks.length})
              </label>
              <div className="grid grid-cols-1 gap-2">
                {selectedLinks.length === 0 && (
                  <div className="text-center p-6 md:p-8 border border-dashed border-white/30 dark:border-white/10 rounded-xl text-muted-foreground/50 text-sm bg-white/30 dark:bg-black/20 backdrop-blur-lg">
                    Select "Link" on items from the wire to add them here.
                  </div>
                )}
                {selectedLinks.map(link => (
                  <div key={link.id} className="flex items-center justify-between p-2 md:p-3 rounded-lg border border-white/30 dark:border-white/10 bg-white/50 dark:bg-black/30 backdrop-blur-md shadow-md">
                    <div className="flex items-center gap-2 md:gap-3 overflow-hidden flex-1 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="font-medium text-xs md:text-sm truncate">{link.title}</span>
                      <span className="text-[10px] md:text-xs text-muted-foreground shrink-0 hidden sm:block border-l border-border/50 pl-2 md:pl-3 ml-1">{link.source}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" onClick={() => toggleLink(link)}>
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
