import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NewsletterEditor } from "@/components/NewsletterEditor";
import { useAutoSave } from "@/hooks/useAutoSave";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Share, Image as ImageIcon, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function EditorPage() {
    const { id } = useParams();
    const [location, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const [content, setContent] = useState("");
    const [heroImageUrl, setHeroImageUrl] = useState("");
    const [heroImagePrompt, setHeroImagePrompt] = useState("");

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

    // Init content and image from draft
    useEffect(() => {
        if (draft) {
            setContent(draft.content || "");
            setHeroImageUrl(draft.heroImageUrl || "");
            setHeroImagePrompt(draft.heroImagePrompt || "");
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

    const generatePromptMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/drafts/${id}/generate-prompt`, {
                method: "POST",
            });
            if (!res.ok) throw new Error("Failed to generate prompt");
            return res.json();
        },
        onSuccess: (data) => {
            setHeroImagePrompt(data.prompt);
            toast.success("Prompt generated! Edit it and click 'Generate Hero Image'");
        },
        onError: () => {
            toast.error("Failed to generate prompt");
        }
    });

    const generateImageMutation = useMutation({
        mutationFn: async (prompt: string) => {
            const res = await fetch(`/api/drafts/${id}/regenerate-image`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt }),
            });
            if (!res.ok) throw new Error("Failed to generate image");
            return res.json();
        },
        onSuccess: (data) => {
            setHeroImageUrl(data.imageUrl);
            toast.success("Hero image generated!");
            queryClient.invalidateQueries({ queryKey: ["draft", id] });
        },
        onError: () => {
            toast.error("Failed to generate image");
        }
    });

    const regenerateImageMutation = useMutation({
        mutationFn: async (prompt: string) => {
            const res = await fetch(`/api/drafts/${id}/regenerate-image`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt }),
            });
            if (!res.ok) throw new Error("Failed to regenerate image");
            return res.json();
        },
        onSuccess: (data) => {
            setHeroImageUrl(data.imageUrl);
            toast.success("Hero image regenerated!");
            queryClient.invalidateQueries({ queryKey: ["draft", id] });
        },
        onError: () => {
            toast.error("Failed to regenerate image");
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
                <div className="h-full overflow-y-auto p-6 max-w-5xl mx-auto space-y-6">
                    {/* Hero Image Section */}
                    {!isNew && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ImageIcon className="h-5 w-5" />
                                    Hero Image
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Image Preview */}
                                {heroImageUrl && (
                                    <div className="relative rounded-lg overflow-hidden border">
                                        <img
                                            src={heroImageUrl}
                                            alt="Hero"
                                            className="w-full h-64 object-cover"
                                        />
                                    </div>
                                )}

                                {/* Image Prompt Editor */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Image Prompt</label>
                                    <Textarea
                                        value={heroImagePrompt}
                                        onChange={(e) => setHeroImagePrompt(e.target.value)}
                                        placeholder="Click 'Generate Pic Prompt' to create a prompt, then edit it if you like..."
                                        rows={3}
                                        className="resize-none"
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2">
                                    {!heroImagePrompt ? (
                                        // No prompt yet - show "Generate Pic Prompt" button
                                        <Button
                                            onClick={() => generatePromptMutation.mutate()}
                                            disabled={generatePromptMutation.isPending}
                                            className="w-full"
                                            variant="outline"
                                        >
                                            {generatePromptMutation.isPending ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Generating Prompt...
                                                </>
                                            ) : (
                                                <>
                                                    <ImageIcon className="mr-2 h-4 w-4" />
                                                    Generate Pic Prompt
                                                </>
                                            )}
                                        </Button>
                                    ) : !heroImageUrl ? (
                                        // Has prompt but no image - show "Generate Hero Image" button
                                        <Button
                                            onClick={() => generateImageMutation.mutate(heroImagePrompt)}
                                            disabled={generateImageMutation.isPending || !heroImagePrompt.trim()}
                                            className="w-full"
                                        >
                                            {generateImageMutation.isPending ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Generating Image...
                                                </>
                                            ) : (
                                                <>
                                                    <ImageIcon className="mr-2 h-4 w-4" />
                                                    Generate Hero Image
                                                </>
                                            )}
                                        </Button>
                                    ) : (
                                        // Has both prompt and image - show "Regenerate" button
                                        <Button
                                            onClick={() => regenerateImageMutation.mutate(heroImagePrompt)}
                                            disabled={regenerateImageMutation.isPending || !heroImagePrompt.trim()}
                                            className="w-full"
                                            variant="outline"
                                        >
                                            {regenerateImageMutation.isPending ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Regenerating...
                                                </>
                                            ) : (
                                                <>
                                                    <RefreshCw className="mr-2 h-4 w-4" />
                                                    Regenerate Image
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Newsletter Content Editor */}
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
