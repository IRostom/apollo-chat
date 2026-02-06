import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const chatsTable = sqliteTable("conversations_table", {
  id: int().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  model: text().notNull(),
  created_at: text()
    .notNull()
    .default(sql`(current_timestamp)`),
  updated_at: text()
    .notNull()
    .default(sql`(current_timestamp)`)
    .$onUpdate(() => sql`(current_timestamp)`),
});

export const messagesTable = sqliteTable("messages_table", {
  id: int().primaryKey({ autoIncrement: true }),
  conversation_id: int().references(() => chatsTable.id),
  content: text().notNull(),
  thinking: text(),
  tool_calls: text(),
  tool_name: text(),
  role: text().notNull(),
  images: text(),
  created_at: text()
    .notNull()
    .default(sql`(current_timestamp)`),
  updated_at: text()
    .notNull()
    .default(sql`(current_timestamp)`)
    .$onUpdate(() => sql`(current_timestamp)`),
  metadata: text(),
});

export const filesTable = sqliteTable("files_table", {
  id: int().primaryKey({ autoIncrement: true }),
  filename: text().notNull(),
  path: text().notNull(),
  type: text(),
  created_at: text()
    .notNull()
    .default(sql`(current_timestamp)`),
  updated_at: text()
    .notNull()
    .default(sql`(current_timestamp)`)
    .$onUpdate(() => sql`(current_timestamp)`),
});

// AI SDK tables for the new v1 chat API
export const aiConversationsTable = sqliteTable("ai_conversations", {
  id: int().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  provider: text().notNull(), // 'openai' | 'google' | 'anthropic' | 'ollama'
  model: text().notNull(),
  system_prompt: text(),
  created_at: text()
    .notNull()
    .default(sql`(current_timestamp)`),
  updated_at: text()
    .notNull()
    .default(sql`(current_timestamp)`)
    .$onUpdate(() => sql`(current_timestamp)`),
});

export const aiMessagesTable = sqliteTable("ai_messages", {
  id: int().primaryKey({ autoIncrement: true }),
  conversation_id: int()
    .notNull()
    .references(() => aiConversationsTable.id),
  role: text().notNull(), // 'user' | 'assistant' | 'tool' — kept for query convenience
  message: text().notNull(), // JSON-serialized ModelMessage from AI SDK
  metadata: text(), // JSON string for usage stats, finish reason, etc.
  created_at: text()
    .notNull()
    .default(sql`(current_timestamp)`),
});
