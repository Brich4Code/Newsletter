import { google, docs_v1 } from "googleapis";
import { JWT } from "google-auth-library";
import { log } from "../index";

export interface NewsletterContent {
  markdown: string;
  heroImageUrl?: string;
  issueNumber: number;
  videoUrl?: string;
}

interface FormattingInstruction {
  type: "heading" | "bold" | "link";
  startIndex: number;
  endIndex: number;
  level?: number; // for headings
  url?: string; // for links
}

/**
 * Service for creating and formatting Google Docs
 * Converts Markdown newsletter content into properly formatted Google Docs
 * Uses lazy initialization to avoid crashes when credentials are not set at startup
 */
export class GoogleDocsService {
  private docs: docs_v1.Docs | null = null;
  private drive: any = null;
  private auth: JWT | null = null;

  /**
   * Initialize the service (lazy - only called when first needed)
   */
  private initialize(): void {
    if (this.auth) {
      return; // Already initialized
    }

    // Service Account authentication
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!email || !privateKey) {
      throw new Error(
        "Google Service Account credentials not configured. " +
        "Please set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in Replit Secrets."
      );
    }

    log(`[Google Docs] Initializing with email: ${email}`, "docs");
    log(`[Google Docs] Private key starts with: ${privateKey?.substring(0, 30)}...`, "docs");
    log(`[Google Docs] Private key length: ${privateKey?.length}`, "docs");

    this.auth = new JWT({
      email,
      key: privateKey,
      scopes: [
        "https://www.googleapis.com/auth/documents",
        "https://www.googleapis.com/auth/drive",
      ],
    });

    this.docs = google.docs({ version: "v1", auth: this.auth });
    this.drive = google.drive({ version: "v3", auth: this.auth });

    log("[Google Docs] Service initialized successfully", "docs");
  }

  /**
   * Create a fully formatted newsletter document in Google Docs
   */
  async createNewsletterDocument(content: NewsletterContent): Promise<string> {
    this.initialize();

    try {
      log("[Google Docs] Creating newsletter document...", "docs");
      log(`[Google Docs] Using service account: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`, "docs");

      // 1. Create blank document
      log("[Google Docs] Step 1: Creating blank document...", "docs");
      const doc = await this.docs!.documents.create({
        requestBody: {
          title: `Hello Jumble - Issue #${content.issueNumber}`,
        },
      });
      log("[Google Docs] Step 1: Document created successfully", "docs");

      const documentId = doc.data.documentId!;
      log(`[Google Docs] Created document: ${documentId}`, "docs");

      // 2. Parse markdown and build formatting instructions
      const { plainText, formatting } = this.parseMarkdown(content.markdown);

      // 3. Insert all text at once
      await this.docs!.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: plainText,
              },
            },
          ],
        },
      });

      // 4. Apply all formatting
      const formattingRequests = this.buildFormattingRequests(formatting);

      if (formattingRequests.length > 0) {
        await this.docs!.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: formattingRequests,
          },
        });
      }

      // 5. Insert hero image at the top (if provided)
      if (content.heroImageUrl) {
        await this.insertImage(documentId, content.heroImageUrl, 1);
      }

      // 6. Share document with editor
      const editorEmail = process.env.EDITOR_EMAIL;
      if (editorEmail) {
        await this.shareDocument(documentId, editorEmail);
      }

      // 7. Move to specific folder (if configured)
      const folderId = process.env.GOOGLE_DOCS_FOLDER_ID;
      if (folderId) {
        await this.moveToFolder(documentId, folderId);
      }

      const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;
      log(`[Google Docs] Newsletter created: ${docUrl}`, "docs");

      return docUrl;
    } catch (error) {
      log(`[Google Docs] Error: ${error}`, "docs");
      throw new Error(`Failed to create Google Doc: ${error}`);
    }
  }

  /**
   * Parse Markdown into plain text and formatting instructions
   */
  private parseMarkdown(markdown: string): {
    plainText: string;
    formatting: FormattingInstruction[];
  } {
    let plainText = markdown;
    const formatting: FormattingInstruction[] = [];

    // Track offset as we remove markdown syntax
    let offset = 0;

    // 1. Parse headers (# H1, ## H2, ### H3)
    const headerRegex = /^(#{1,3})\s+(.+)$/gm;
    plainText = plainText.replace(headerRegex, (match, hashes, content, matchIndex) => {
      const level = hashes.length;
      const startIndex = matchIndex - offset + 1; // +1 for Docs API (1-indexed)
      const endIndex = startIndex + content.length;

      formatting.push({
        type: "heading",
        startIndex,
        endIndex,
        level,
      });

      // Update offset for removed markdown syntax
      offset += hashes.length + 1; // hashes + space

      return content + "\n";
    });

    // 2. Parse bold (**text**)
    const boldRegex = /\*\*([^*]+)\*\*/g;
    plainText = plainText.replace(boldRegex, (match, content, matchIndex) => {
      const startIndex = matchIndex - offset + 1;
      const endIndex = startIndex + content.length;

      formatting.push({
        type: "bold",
        startIndex,
        endIndex,
      });

      offset += 4; // two ** on each side
      return content;
    });

    // 3. Parse links ([text](url))
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    plainText = plainText.replace(linkRegex, (match, text, url, matchIndex) => {
      const startIndex = matchIndex - offset + 1;
      const endIndex = startIndex + text.length;

      formatting.push({
        type: "link",
        startIndex,
        endIndex,
        url,
      });

      offset += match.length - text.length; // remove markdown syntax
      return text;
    });

    return { plainText, formatting };
  }

  /**
   * Build Google Docs API requests for formatting
   */
  private buildFormattingRequests(formatting: FormattingInstruction[]): any[] {
    const requests: any[] = [];

    for (const instruction of formatting) {
      switch (instruction.type) {
        case "heading":
          requests.push({
            updateParagraphStyle: {
              range: {
                startIndex: instruction.startIndex,
                endIndex: instruction.endIndex,
              },
              paragraphStyle: {
                namedStyleType: `HEADING_${instruction.level}`,
              },
              fields: "namedStyleType",
            },
          });
          break;

        case "bold":
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: instruction.startIndex,
                endIndex: instruction.endIndex,
              },
              textStyle: {
                bold: true,
              },
              fields: "bold",
            },
          });
          break;

        case "link":
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: instruction.startIndex,
                endIndex: instruction.endIndex,
              },
              textStyle: {
                link: {
                  url: instruction.url,
                },
              },
              fields: "link",
            },
          });
          break;
      }
    }

    return requests;
  }

  /**
   * Insert an image into the document at the specified index
   */
  private async insertImage(
    documentId: string,
    imageUrl: string,
    index: number
  ): Promise<void> {
    try {
      await this.docs!.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertInlineImage: {
                location: { index },
                uri: imageUrl,
                objectSize: {
                  height: {
                    magnitude: 300,
                    unit: "PT",
                  },
                  width: {
                    magnitude: 500,
                    unit: "PT",
                  },
                },
              },
            },
          ],
        },
      });
      log("[Google Docs] Hero image inserted", "docs");
    } catch (error) {
      log(`[Google Docs] Failed to insert image: ${error}`, "docs");
    }
  }

  /**
   * Share document with a specific email address
   */
  private async shareDocument(documentId: string, email: string): Promise<void> {
    try {
      await this.drive!.permissions.create({
        fileId: documentId,
        requestBody: {
          type: "user",
          role: "writer",
          emailAddress: email,
        },
        fields: "id",
      });
      log(`[Google Docs] Shared with ${email}`, "docs");
    } catch (error) {
      log(`[Google Docs] Failed to share: ${error}`, "docs");
    }
  }

  /**
   * Move document to a specific folder
   */
  private async moveToFolder(documentId: string, folderId: string): Promise<void> {
    try {
      await this.drive!.files.update({
        fileId: documentId,
        addParents: folderId,
        fields: "id, parents",
      });
      log(`[Google Docs] Moved to folder ${folderId}`, "docs");
    } catch (error) {
      log(`[Google Docs] Failed to move to folder: ${error}`, "docs");
    }
  }
}

// Singleton instance
export const googleDocsService = new GoogleDocsService();
