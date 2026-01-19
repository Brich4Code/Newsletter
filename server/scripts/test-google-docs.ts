
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
    const drive = google.drive({ version: "v3", auth });

    // TEST 1: Check Drive Identity & Capabilities
    log("\n--- TEST 1: Checking Drive API Access ---");
    try {
      const about = await drive.about.get({ fields: "user, storageQuota" });
      log(`Connected as: ${about.data.user?.emailAddress}`);
      log(`Name: ${about.data.user?.displayName}`);
    } catch (e: any) {
      log(`[FAILED] Could not access Drive API 'about': ${e.message}`);
      // Proceeding anyway
    }

    // TEST 2: Create via Drive API (Alternative Method)
    log("\n--- TEST 2: Creating Doc via Google Drive API ---");
    try {
      const driveFile = await drive.files.create({
        requestBody: {
          name: `Test Doc (Drive API) ${new Date().toISOString()}`,
          mimeType: "application/vnd.google-apps.document",
        },
      });
      log(`[SUCCESS] Created via Drive API! ID: ${driveFile.data.id}`);
      log(`URL: https://docs.google.com/document/d/${driveFile.data.id}/edit`);
      return; // If this works, we are good!
    } catch (e: any) {
      log(`[FAILED] Drive API Create failed: ${e.message}`);
    }

    // TEST 3: Original Docs API Method
    log("\n--- TEST 3: Creating Doc via Google Docs API (Original Method) ---");
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
    log("\n[FINAL FAILURE SUMMARY]");
    log(`Error Message: ${error.message}`);
    
    if (error.response) {
        log(`Status: ${error.response.status}`);
        // log("Full API Error:");
        // console.log(JSON.stringify(error.response.data, null, 2));
    }

    if (error.message.includes("The caller does not have permission")) {
        log("\n--- DIAGNOSIS HINTS ---");
        log("1. Double check you are in project 'newsletter-app-production' in Cloud Console.");
        log("2. Ensure 'Google Drive API' is ENABLED (sometimes it's missed).");
        log("3. If you just enabled the APIs, wait 5 minutes and try again.");
    }
  }
}

testGoogleDocs();
