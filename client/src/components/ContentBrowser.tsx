import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Plus, Calendar } from "lucide-react";
import { format } from "date-fns";

export function ContentBrowser() {
    const { data: drafts, isLoading } = useQuery({
        queryKey: ["drafts"],
        queryFn: async () => {
            const res = await fetch("/api/drafts");
            if (!res.ok) throw new Error("Failed to fetch drafts");
            return res.json();
        },
    });

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    // Assuming drafts is an array of NewsletterDraft
    // We can group or filter them if needed.

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Content Library</h2>
                <Link href="/editor/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> New Draft
                    </Button>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {drafts?.map((draft: any) => (
                    <Link key={draft.id} href={`/editor/${draft.id}`}>
                        <Card className="cursor-pointer hover:border-primary transition-colors">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <Badge variant={draft.status === 'published' ? 'default' : 'secondary'}>
                                        {draft.status}
                                    </Badge>
                                    {draft.issueNumber > 0 && (
                                        <span className="text-xs font-mono text-muted-foreground">#{draft.issueNumber}</span>
                                    )}
                                </div>
                                <CardTitle className="mt-2 text-lg line-clamp-1">
                                    {draft.issueNumber ? `Issue #${draft.issueNumber}` : 'Untitled Draft'}
                                </CardTitle>
                                <CardDescription className="line-clamp-2">
                                    {/* Preview content - assuming content is markdown/text */}
                                    {draft.content.substring(0, 100)}...
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center text-xs text-muted-foreground gap-4">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(draft.updatedAt), 'MMM d, yyyy')}
                                    </div>
                                    {/* Word count could go here */}
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}

                {drafts?.length === 0 && (
                    <div className="col-span-full text-center p-12 text-muted-foreground">
                        No drafts found. Create your first one!
                    </div>
                )}
            </div>
        </div>
    );
}
