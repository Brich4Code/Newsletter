import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NewsletterEditor } from "@/components/NewsletterEditor";
import { useAutoSave } from "@/hooks/useAutoSave";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Share } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function EditorPage() {
    const { id } = useParams();
    const [location, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const [content, setContent] = useState("");

    const isNew = id === "new";

    // Fetch draft if editing existing
    const { data: draft, isLoading } = useQuery({
        queryKey: ["draft", id],
        queryFn: async () => {
            if (isNew) return null;
            const res = await fetch(`/api/drafts/${id}`);
            if (!res.ok) throw new Error("Failed to load draft");
            return res.json();
        },
        enabled: !isNew && !!id,
    });

    // Init content from draft
    useEffect(() => {
        if (draft) {
            setContent(draft.content || "");
        }
    }, [draft]);

    // Mutations
    const createDraftMutation = useMutation({
        mutationFn: async (newContent: string) => {
            // For new drafts, we probably need an issue number. 
            // For now, let's assume we are creating a generic draft or ask user.
            // But typically this flow starts from "Generate Issue". 
            // Let's assume we pass issueNumber via query params or default to 0 for generic.
            const res = await fetch("/api/drafts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: newContent,
                    issueNumber: 0, // Placeholder, ideally should be dynamic
                    issueId: null
                }),
            });
            if (!res.ok) throw new Error("Failed to create draft");
            return res.json();
        },
        onSuccess: (data) => {
            setLocation(`/editor/${data.id}`); // Redirect to edit mode
            toast.success("Draft created");
        },
    });

    const updateDraftMutation = useMutation({
        mutationFn: async (newContent: string) => {
            if (isNew) return; // Should have triggered create
            const res = await fetch(`/api/drafts/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: newContent }),
            });
            if (!res.ok) throw new Error("Failed to display draft");
            // Error message fix: "Failed to save draft"
            if (!res.ok) throw new Error("Failed to save draft");
            return res.json();
        },
    });

    const publishMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/drafts/${id}/publish`, {
                method: "POST",
            });
            if (!res.ok) throw new Error("Failed to publish");
            return res.json();
        },
        onSuccess: () => {
            toast.success("Newsletter published!");
            queryClient.invalidateQueries({ queryKey: ["drafts"] });
            queryClient.invalidateQueries({ queryKey: ["draft", id] });
        },
        onError: (err) => {
            toast.error("Failed to publish");
        }
    });

    // Handle Save (Auto or Manual)
    const handleSave = async (newContent: string) => {
        setContent(newContent);
        if (isNew) {
            // Don't auto-create on every keystroke for 'new', maybe wait?
            // For simplicity, let's only auto-save if we have an ID.
            // Or create immediately on first edit? 
            // Let's simple require manual first save or handle 'new' separately.
            // Actually, useAutoSave will call this.
            // If isNew, we might want to wait for explicit 'Create'.
        } else {
            await updateDraftMutation.mutateAsync(newContent);
        }
    };

    const { isSaving, lastSavedAt, error: saveError } = useAutoSave(
        content,
        handleSave,
        3000
    );

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b bg-card">
                <div className="flex items-center gap-4">
                    <Link href="/content">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-lg font-semibold">
                            {isNew ? "New Draft" : `Issue #${draft?.issueNumber || 'Untitled'}`}
                        </h1>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${draft?.status === 'published' ? 'bg-green-500' : 'bg-yellow-500'
                                }`} />
                            {draft?.status?.toUpperCase() || 'DRAFT'}
                            {lastSavedAt && ` • Saved ${lastSavedAt.toLocaleTimeString()}`}
                            {isSaving && " • Saving..."}
                            {saveError && " • Error saving"}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!isNew && (
                        <Button
                            onClick={() => publishMutation.mutate()}
                            disabled={publishMutation.isPending || draft?.status === 'published'}
                        >
                            {publishMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share className="mr-2 h-4 w-4" />}
                            {draft?.status === 'published' ? 'Published' : 'Publish Issue'}
                        </Button>
                    )}
                    {isNew && (
                        <Button
                            onClick={() => createDraftMutation.mutate(content)}
                            disabled={createDraftMutation.isPending}
                        >
                            Create Draft
                        </Button>
                    )}
                </div>
            </header>

            {/* Editor Area */}
            <main className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto p-6 max-w-5xl mx-auto">
                    <Card className="border-none shadow-none">
                        <CardContent className="p-0">
                            <NewsletterEditor
                                initialContent={content}
                                onSave={setContent} // We update local state immediately
                                isSaving={isSaving}
                            />
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
