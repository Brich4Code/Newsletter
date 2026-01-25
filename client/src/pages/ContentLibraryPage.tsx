import { ContentBrowser } from "@/components/ContentBrowser";
import { SidebarProvider } from "@/components/ui/sidebar" // Assuming sidebar structure exists or generic layout

export default function ContentLibraryPage() {
    return (
        <div className="container mx-auto py-8 px-4">
            <ContentBrowser />
        </div>
    );
}
