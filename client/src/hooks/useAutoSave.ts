
import { useState, useEffect, useRef, useCallback } from "react";

export interface AutoSaveResult {
    isSaving: boolean;
    lastSavedAt: Date | null;
    error: Error | null;
}

export function useAutoSave(
    content: string,
    onSave: (content: string) => Promise<void> | void,
    debounceMs: number = 3000
): AutoSaveResult {
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const lastSavedContent = useRef(content);
    const timeoutRef = useRef<NodeJS.Timeout>();

    const save = useCallback(async (contentToSave: string) => {
        try {
            setIsSaving(true);
            setError(null);
            await onSave(contentToSave);
            setLastSavedAt(new Date());
            lastSavedContent.current = contentToSave;
        } catch (err) {
            setError(err instanceof Error ? err : new Error("Failed to save"));
            console.error("Auto-save failed:", err);
        } finally {
            setIsSaving(false);
        }
    }, [onSave]);

    useEffect(() => {
        // Skip if content hasn't changed from last successful save
        if (content === lastSavedContent.current) return;

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            save(content);
        }, debounceMs);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [content, debounceMs, save]);

    return { isSaving, lastSavedAt, error };
}
