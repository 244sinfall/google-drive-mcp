import { OAuth2Client } from "google-auth-library";
import * as fs from "fs/promises";
import {
  getKeysFilePath,
  generateCredentialsErrorMessage,
  OAuthCredentials,
} from "./utils.js";

function parseCredentialsObject(keys: any): OAuthCredentials {
  if (keys.installed) {
    // Standard OAuth credentials file format
    const { client_id, client_secret, redirect_uris } = keys.installed;
    return { client_id, client_secret, redirect_uris };
  } else if (keys.web) {
    // Web application credentials format
    const { client_id, client_secret, redirect_uris } = keys.web;
    return { client_id, client_secret, redirect_uris };
  } else if (keys.client_id) {
    // Direct format (simplified)
    return {
      client_id: keys.client_id,
      client_secret: keys.client_secret,
      redirect_uris: keys.redirect_uris || [
        "http://localhost:3000/oauth2callback",
      ],
    };
  } else {
    throw new Error(
      'Invalid credentials file format. Expected either "installed", "web" object or direct client_id field.',
    );
  }
}

function parseCredentialsContent(
  content: string,
  source: string,
): OAuthCredentials {
  let keys: any;
  try {
    keys = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${source}: ${error instanceof Error ? error.message : error}`,
    );
  }
  return parseCredentialsObject(keys);
}

function loadCredentialsFromEnv(): OAuthCredentials | null {
  const jsonEnv = process.env.GOOGLE_DRIVE_OAUTH_CREDENTIALS_JSON;
  if (jsonEnv) {
    return parseCredentialsContent(
      jsonEnv,
      "GOOGLE_DRIVE_OAUTH_CREDENTIALS_JSON",
    );
  }

  const base64Env =
    process.env.GOOGLE_DRIVE_OAUTH_CREDENTIALS_JSON_BASE64 ||
    process.env.GOOGLE_DRIVE_OAUTH_CREDENTIALS_BASE64;
  if (base64Env) {
    let decoded: string;
    try {
      decoded = Buffer.from(base64Env, "base64").toString("utf-8");
    } catch (error) {
      throw new Error(
        `Invalid base64 in GOOGLE_DRIVE_OAUTH_CREDENTIALS_JSON_BASE64: ${error instanceof Error ? error.message : error}`,
      );
    }
    return parseCredentialsContent(
      decoded,
      "GOOGLE_DRIVE_OAUTH_CREDENTIALS_JSON_BASE64",
    );
  }

  return null;
}

async function loadCredentialsFromFile(): Promise<OAuthCredentials> {
  const keysContent = await fs.readFile(getKeysFilePath(), "utf-8");
  return parseCredentialsContent(keysContent, getKeysFilePath());
}

async function loadCredentialsWithFallback(): Promise<OAuthCredentials> {
  const envCredentials = loadCredentialsFromEnv();
  if (envCredentials) {
    return envCredentials;
  }

  try {
    return await loadCredentialsFromFile();
  } catch (fileError) {
    // Check for legacy client_secret.json
    const legacyPath =
      process.env.GOOGLE_CLIENT_SECRET_PATH || "client_secret.json";
    try {
      const legacyContent = await fs.readFile(legacyPath, "utf-8");
      const legacyKeys = JSON.parse(legacyContent);
      console.error(
        "Warning: Using legacy client_secret.json. Please migrate to gcp-oauth.keys.json",
      );

      if (legacyKeys.installed) {
        return legacyKeys.installed;
      } else if (legacyKeys.web) {
        return legacyKeys.web;
      } else {
        throw new Error("Invalid legacy credentials format");
      }
    } catch (legacyError) {
      // Generate helpful error message
      const errorMessage = generateCredentialsErrorMessage();
      throw new Error(
        `${errorMessage}\n\nOriginal error: ${fileError instanceof Error ? fileError.message : fileError}`,
      );
    }
  }
}

export async function initializeOAuth2Client(): Promise<OAuth2Client> {
  try {
    const credentials = await loadCredentialsWithFallback();

    // Use the first redirect URI as the default for the base client
    return new OAuth2Client({
      clientId: credentials.client_id,
      clientSecret: credentials.client_secret || undefined,
      redirectUri:
        credentials.redirect_uris?.[0] ||
        "http://localhost:3000/oauth2callback",
    });
  } catch (error) {
    throw new Error(
      `Error loading OAuth keys: ${error instanceof Error ? error.message : error}`,
    );
  }
}

export async function loadCredentials(): Promise<{
  client_id: string;
  client_secret?: string;
}> {
  try {
    const credentials = await loadCredentialsWithFallback();

    if (!credentials.client_id) {
      throw new Error("Client ID missing in credentials.");
    }
    return {
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
    };
  } catch (error) {
    throw new Error(
      `Error loading credentials: ${error instanceof Error ? error.message : error}`,
    );
  }
}
