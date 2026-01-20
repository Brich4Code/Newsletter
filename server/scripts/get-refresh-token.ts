
import { google } from "googleapis";
import readline from "readline";

// Scopes we need
const SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.file", // Only access files created by this app
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function getRefreshToken() {
  console.log("\n=== Google OAuth2 Refresh Token Generator ===\n");

  const clientId = await ask("Enter your OAuth Client ID: ");
  const clientSecret = await ask("Enter your OAuth Client Secret: ");

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "urn:ietf:wg:oauth:2.0:oob" // Special redirect URI for manual copy-paste
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline", // Crucial for getting a refresh token
    scope: SCOPES,
    prompt: "consent", // Force consent screen to ensure we get a refresh token
  });

  console.log("\nAuthorize this app by visiting this url:\n");
  console.log(authUrl);
  console.log("\n");

  const code = await ask("Enter the code from that page here: ");
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log("\n=== SUCCESS! HERE ARE YOUR NEW SECRETS ===\n");
    console.log(`GOOGLE_CLIENT_ID=${clientId}`);
    console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log("\n(Copy these 3 values into your Replit Secrets and delete the old Service Account ones)");

  } catch (error) {
    console.error("\nError retrieving access token:", error);
  } finally {
    rl.close();
  }
}

getRefreshToken();
