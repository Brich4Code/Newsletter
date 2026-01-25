
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
    Bold, Italic, List, ListOrdered,
    Heading1, Heading2, Quote, Undo, Redo,
    Link as LinkIcon, Image as ImageIcon
} from 'lucide-react'
import Showdown from 'showdown'
import TurndownService from 'turndown'
import { useEffect } from 'react'

interface NewsletterEditorProps {
    initialContent: string;
    onSave: (content: string) => void;
    isSaving: boolean;
}

const converter = new Showdown.Converter();
const turndownService = new TurndownService();

// Menu Bar Component
const MenuBar = ({ editor }: { editor: any }) => {
    if (!editor) {
        return null;
    }

    const addLink = () => {
        const previousUrl = editor.getAttributes('link').href
        const url = window.prompt('URL', previousUrl)

        if (url === null) {
            return
        }

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            return
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }

    const addImage = () => {
        const url = window.prompt('Image URL')
        if (url) {
            editor.chain().focus().setImage({ src: url }).run()
        }
    }

    return (
        <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/40 my-2 rounded-t-lg">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={editor.isActive('bold') ? 'bg-muted' : ''}
            >
                <Bold className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={editor.isActive('italic') ? 'bg-muted' : ''}
            >
                <Italic className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1 my-auto" />

            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={editor.isActive('heading', { level: 1 }) ? 'bg-muted' : ''}
            >
                <Heading1 className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={editor.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}
            >
                <Heading2 className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1 my-auto" />

            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={editor.isActive('bulletList') ? 'bg-muted' : ''}
            >
                <List className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={editor.isActive('orderedList') ? 'bg-muted' : ''}
            >
                <ListOrdered className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-border mx-1 my-auto" />

            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={editor.isActive('blockquote') ? 'bg-muted' : ''}
            >
                <Quote className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={addLink}
                className={editor.isActive('link') ? 'bg-muted' : ''}
            >
                <LinkIcon className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={addImage}
            >
                <ImageIcon className="h-4 w-4" />
            </Button>

            <div className="flex-1" />

            <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()}>
                <Undo className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()}>
                <Redo className="h-4 w-4" />
            </Button>
        </div>
    )
}

export function NewsletterEditor({ initialContent, onSave, isSaving }: NewsletterEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-primary underline cursor-pointer',
                },
            }),
            Image.configure({
                HTMLAttributes: {
                    class: 'rounded-lg border max-w-full my-4',
                },
            }),
        ],
        content: '', // Start empty, will be set by useEffect
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl m-5 focus:outline-none min-h-[500px]',
            },
        },
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            // Convert HTML back to markdown for storage using Turndown
            const markdown = turndownService.turndown(html);
            onSave(markdown);
        },
    });

    // Update content when initialContent changes (e.g. loaded from DB)
    useEffect(() => {
        if (editor && initialContent) {
            // Convert markdown to HTML for display
            const htmlContent = converter.makeHtml(initialContent);
            // Get current HTML to compare
            const currentHtml = editor.getHTML();

            // Only update if content is actually different (avoid unnecessary updates)
            if (currentHtml !== htmlContent) {
                editor.commands.setContent(htmlContent);
            }
        }
    }, [initialContent, editor]);

    return (
        <div className="flex flex-col min-h-[600px] border rounded-lg shadow-sm bg-card">
            <MenuBar editor={editor} />
            <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950 p-4 min-h-[500px]">
                <EditorContent editor={editor} />
            </div>
            <div className="p-2 border-t bg-muted/20 text-xs text-muted-foreground flex justify-end">
                {isSaving ? "Saving..." : "Saved locally"}
            </div>
        </div>
    )
}
