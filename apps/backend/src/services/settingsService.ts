import { db } from "../db/client";
import { settingsTable } from "../db/schema";
import { eq } from "drizzle-orm";

/**
 * Get a setting value by key
 */
export async function getSetting(key: string): Promise<string | null> {
  const [result] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key));
  return result?.value ?? null;
}

/**
 * Set a setting value
 * Creates the setting if it doesn't exist, updates if it does
 */
export async function setSetting(key: string, value: string): Promise<void> {
  const existing = await getSetting(key);

  if (existing !== null) {
    await db
      .update(settingsTable)
      .set({ value })
      .where(eq(settingsTable.key, key));
  } else {
    await db.insert(settingsTable).values({ key, value });
  }
}

/**
 * Delete a setting by key
 */
export async function deleteSetting(key: string): Promise<void> {
  await db.delete(settingsTable).where(eq(settingsTable.key, key));
}

/**
 * Get all settings
 * @param maskSecrets - If true, mask API key values for display
 */
export async function getAllSettings(
  maskSecrets: boolean = true
): Promise<Array<{ key: string; value: string; isMasked: boolean }>> {
  const results = await db.select().from(settingsTable);

  return results.map((setting) => {
    const isApiKey =
      setting.key.includes("API_KEY") || setting.key.includes("SECRET");
    const shouldMask = maskSecrets && isApiKey;

    return {
      key: setting.key,
      value: shouldMask ? maskValue(setting.value) : setting.value,
      isMasked: shouldMask,
    };
  });
}

/**
 * Mask a secret value for display
 */
function maskValue(value: string): string {
  if (value.length <= 8) {
    return "****";
  }
  return value.slice(0, 4) + "****" + value.slice(-4);
}

/**
 * API key settings constants
 */
export const API_KEY_SETTINGS = {
  OPENAI_API_KEY: "OPENAI_API_KEY",
  GOOGLE_API_KEY: "GOOGLE_GENERATIVE_AI_API_KEY",
  ANTHROPIC_API_KEY: "ANTHROPIC_API_KEY",
} as const;

/**
 * Check if an API key is configured (either in env or database)
 */
export async function isApiKeyConfigured(
  keyName: string
): Promise<{ configured: boolean; source: "env" | "database" | null }> {
  // Check environment first
  if (process.env[keyName]) {
    return { configured: true, source: "env" };
  }

  // Check database
  const dbValue = await getSetting(keyName);
  if (dbValue) {
    return { configured: true, source: "database" };
  }

  return { configured: false, source: null };
}

/**
 * Get API key value (checks env first, then database)
 */
export async function getApiKey(keyName: string): Promise<string | null> {
  // Environment takes precedence
  if (process.env[keyName]) {
    return process.env[keyName]!;
  }

  // Fall back to database
  return getSetting(keyName);
}
