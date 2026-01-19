
import { google } from "googleapis";
import { JWT } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";

// Simple logger
const log = (msg: string) => console.log(`[Test] ${msg}`);

async function testGoogleDocs() {
  log("Starting Google Docs API connection test...");

  // Load env vars if running locally (though in Replit/Docker they should be present)
  // This is a minimal check for the required vars
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    log("ERROR: Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY");
    return;
  }

  log(`Using Service Account: ${email}`);
  log(`Private Key Length: ${privateKey.length}`);

  try {
    const auth = new JWT({
      email,
      key: privateKey,
      scopes: [
        "https://www.googleapis.com/auth/documents",
        "https://www.googleapis.com/auth/drive",
      ],
    });

    log("Authenticating...");
    await auth.authorize();
    log("Authentication successful!");

    const docs = google.docs({ version: "v1", auth });

    log("Attempting to create a test document...");
    const res = await docs.documents.create({
      requestBody: {
        title: `Test Document ${new Date().toISOString()}`,
      },
    });

    log("SUCCESS! Document created.");
    log(`Document ID: ${res.data.documentId}`);
    log(`Title: ${res.data.title}`);
    log(`URL: https://docs.google.com/document/d/${res.data.documentId}/edit`);

  } catch (error: any) {
    log("FAILED to create document.");
    log(`Error Message: ${error.message}`);
    
    if (error.response) {
        log(`Status: ${error.response.status}`);
        log("Full API Error:");
        console.log(JSON.stringify(error.response.data, null, 2));
    } else {
        console.log(error);
    }

    if (error.message.includes("The caller does not have permission")) {
        log("\n--- DIAGNOSIS ---");
        log("The 'The caller does not have permission' error usually means:");
        log("1. The 'Google Docs API' is NOT enabled in the Google Cloud Console for this project.");
        log("2. The 'Google Drive API' is NOT enabled.");
        log("3. You are using a restricted 'gen-lang-client' project (from AI Studio).");
        log("   Ensure you created a standard project in https://console.cloud.google.com");
    }
  }
}

testGoogleDocs();
