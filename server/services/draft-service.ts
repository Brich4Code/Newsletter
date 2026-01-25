import { db } from "../db";
import { newsletterDrafts, newsletterVersions, type NewsletterDraft, type InsertNewsletterDraft } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { googleDocsService } from "./google-docs";
import { log } from "../index";

export class DraftService {

    async listDrafts(): Promise<NewsletterDraft[]> {
        return await db.select().from(newsletterDrafts).orderBy(desc(newsletterDrafts.createdAt));
    }

    async getDraft(id: string): Promise<NewsletterDraft | undefined> {
        const [draft] = await db.select().from(newsletterDrafts).where(eq(newsletterDrafts.id, id));
        return draft;
    }

    async getDraftByIssue(issueNumber: number): Promise<NewsletterDraft | undefined> {
        const [draft] = await db.select().from(newsletterDrafts).where(eq(newsletterDrafts.issueNumber, issueNumber));
        return draft;
    }

    async createDraft(issueNumber: number, content: string, issueId?: string): Promise<NewsletterDraft> {
        // Check if exists
        const existing = await this.getDraftByIssue(issueNumber);
        if (existing) {
            throw new Error(`Draft for issue ${issueNumber} already exists`);
        }

        const [draft] = await db.insert(newsletterDrafts).values({
            issueNumber,
            content,
            issueId,
            status: 'draft'
        }).returning();

        return draft;
    }

    async updateDraft(id: string, content: string): Promise<NewsletterDraft> {
        const [draft] = await db.update(newsletterDrafts)
            .set({
                content,
                updatedAt: new Date()
            })
            .where(eq(newsletterDrafts.id, id))
            .returning();

        if (!draft) throw new Error("Draft not found");
        return draft;
    }

    async publishDraft(id: string): Promise<NewsletterDraft> {
        const draft = await this.getDraft(id);
        if (!draft) throw new Error("Draft not found");

        log(`[DraftService] Publishing draft ${id} for issue ${draft.issueNumber}...`, "draft");

        // 1. Create Google Doc
        let googleDocsUrl: string | null = null;
        try {
            googleDocsUrl = await googleDocsService.createNewsletterDocument({
                markdown: draft.content,
                heroImageUrl: draft.heroImageUrl || undefined,
                issueNumber: draft.issueNumber,
            });
            log(`[DraftService] Google Doc created: ${googleDocsUrl}`, "draft");
        } catch (err) {
            log(`[DraftService] Failed to create Google Doc: ${err}`, "draft");
            // We continue to update status even if doc creation fails? 
            // No, maybe we should fail? 
            // For now, let's log and continue, but maybe store error in metadata?
        }

        // 2. Update draft status
        const [updatedDraft] = await db.update(newsletterDrafts)
            .set({
                status: 'published',
                publishedAt: new Date(),
                updatedAt: new Date(),
                googleDocsUrl: googleDocsUrl
            })
            .where(eq(newsletterDrafts.id, id))
            .returning();

        // 3. Create version snapshot
        await db.insert(newsletterVersions).values({
            draftId: updatedDraft.id,
            content: updatedDraft.content,
            versionNumber: await this.getNextVersionNumber(updatedDraft.id),
        });

        return updatedDraft;
    }

    private async getNextVersionNumber(draftId: string): Promise<number> {
        const versions = await db.select().from(newsletterVersions)
            .where(eq(newsletterVersions.draftId, draftId))
            .orderBy(desc(newsletterVersions.versionNumber))
            .limit(1);

        return versions.length > 0 ? versions[0].versionNumber + 1 : 1;
    }
}

export const draftService = new DraftService();
