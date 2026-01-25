import { ContentBrowser } from "@/components/ContentBrowser";
import { SidebarProvider } from "@/components/ui/sidebar" // Assuming sidebar structure exists or generic layout
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function ContentLibraryPage() {
    return (
        <div className="min-h-screen bg-background">
            <header className="border-b bg-card">
                <div className="container mx-auto px-4 py-4 flex items-center gap-4">
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Content Library</h1>
                        <p className="text-sm text-muted-foreground">Manage your newsletter drafts</p>
                    </div>
                </div>
            </header>
            <div className="container mx-auto py-8 px-4">
                <ContentBrowser />
            </div>
        </div>
    );
}
