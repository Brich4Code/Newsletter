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
  private auth: any = null; // JWT | OAuth2Client

  /**
   * Initialize the service (lazy - only called when first needed)
   */
  private initialize(): void {
    if (this.auth) {
      return; // Already initialized
    }

    // Try OAuth2 first (Preferred for personal accounts/folders)
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (clientId && clientSecret && refreshToken) {
      log("[Google Docs] Initializing with OAuth2...", "docs");
      
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret
      );

      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      this.auth = oauth2Client;
      log("[Google Docs] OAuth2 authentication configured", "docs");
    } 
    // Fallback to Service Account (JWT)
    else {
      const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

      if (!email || !privateKey) {
        throw new Error(
          "Google Credentials not found. Please set GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN (OAuth) " +
          "OR GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY (Service Account)."
        );
      }

      log(`[Google Docs] Initializing with Service Account: ${email}`, "docs");
      
      const hasHeader = privateKey?.includes("BEGIN PRIVATE KEY");
      log(`[Google Docs] Private key has header: ${hasHeader}`, "docs");
      log(`[Google Docs] Private key length: ${privateKey?.length}`, "docs");

      this.auth = new JWT({
        email,
        key: privateKey,
        scopes: [
          "https://www.googleapis.com/auth/documents",
          "https://www.googleapis.com/auth/drive",
        ],
      });
    }

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
      
      // 1. Create document
      let documentId: string;
      const folderId = process.env.GOOGLE_DOCS_FOLDER_ID;
      const title = `Hello Jumble - Issue #${content.issueNumber}`;

      if (folderId) {
         // Create directly in folder
         log(`[Google Docs] Creating document inside folder: ${folderId}`, "docs");
         
         const driveFile = await this.drive.files.create({
            requestBody: {
              name: title,
              mimeType: "application/vnd.google-apps.document",
              parents: [folderId],
            },
         });
         documentId = driveFile.data.id;
         log(`[Google Docs] Created document via Drive API: ${documentId}`, "docs");
      } else {
         // Create in root
         log("[Google Docs] Creating document in root (My Drive)...", "docs");
         const doc = await this.docs!.documents.create({
            requestBody: {
              title: title,
            },
         });
         documentId = doc.data.documentId!;
         log(`[Google Docs] Created document via Docs API: ${documentId}`, "docs");
      }
      
      log("[Google Docs] Step 1: Document created successfully", "docs");
      
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

      // 7. Move to folder - ALREADY DONE AT CREATION
      // The document is created directly inside the target folder to avoid quota limits.

      const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;
      log(`[Google Docs] Newsletter created: ${docUrl}`, "docs");

      return docUrl;
    } catch (error: any) {
      log(`[Google Docs] Error: ${error.message}`, "docs");
      if (error.response?.data) {
        log(`[Google Docs] API Error Details: ${JSON.stringify(error.response.data, null, 2)}`, "docs");
      }
      throw new Error(`Failed to create Google Doc: ${error.message}`);
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

    // Helper to process regex matches in reverse order
    // Processing in reverse allows us to modify the string without affecting 
    // the indices of matches that appear earlier in the string.
    const processMatches = (
      regex: RegExp,
      getType: (match: RegExpMatchArray) => FormattingInstruction["type"],
      getReplacement: (match: RegExpMatchArray) => string,
      getExtraFields: (match: RegExpMatchArray) => Partial<FormattingInstruction> = () => ({})
    ) => {
      const matches = Array.from(plainText.matchAll(regex)).reverse();

      for (const match of matches) {
        if (match.index === undefined) continue;

        const start = match.index;
        const originalLength = match[0].length;
        const replacement = getReplacement(match);
        const replacementLength = replacement.length;
        const diff = originalLength - replacementLength;

        // 1. Update text
        plainText = plainText.slice(0, start) + replacement + plainText.slice(start + originalLength);

        // 2. Add new formatting item
        // The indices for THIS item are based on the NEW text structure 
        // (after the replacement we just made).
        // Google Docs uses 1-based indexing.
        const newItem: FormattingInstruction = {
          type: getType(match),
          startIndex: start + 1, 
          endIndex: start + 1 + replacementLength,
          ...getExtraFields(match),
        };
        formatting.push(newItem);

        // 3. Update existing formatting items
        // Since we modify the string (shrink it), any existing formatting items 
        // that are located AFTER or CONTAIN this modification need adjustment.
        for (const item of formatting) {
          // Skip the item we just added
          if (item === newItem) continue;

          // Case A: Item is strictly after the modified region
          // Shift it left by the diff amount
          if (item.startIndex > start + 1) {
             item.startIndex -= diff;
             item.endIndex -= diff;
          }
          // Case B: Item strictly contains the modified region (e.g. bold inside header)
          // Shorten the item by the diff amount
          // The item starts before or at the match start, and ends after or at the match end (original end)
          else if (item.startIndex <= start + 1 && item.endIndex >= start + 1 + originalLength) {
             item.endIndex -= diff;
          }
        }
      }
    };

    // 1. Parse headers (# H1, ## H2, ### H3)
    processMatches(
      /^(#{1,3})\s+(.+)$/gm,
      () => "heading",
      (match) => match[2] + "\n", // content + newline
      (match) => ({ level: match[1].length })
    );

    // 2. Parse bold (**text**)
    processMatches(
      /\*\*([^*]+)\*\*/g,
      () => "bold",
      (match) => match[1] // content
    );

    // 3. Parse links ([text](url))
    processMatches(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      () => "link",
      (match) => match[1], // text
      (match) => ({ url: match[2] })
    );

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
