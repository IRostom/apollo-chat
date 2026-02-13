import { int, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const filesTable = sqliteTable(
  "files_table",
  {
    id: text()
      .primaryKey()
      .notNull()
      .default(sql`(lower(hex(randomblob(16))))`),
    key: text().notNull(),
    type: text(),
    user_id: text().notNull(),
    created_at: text()
      .notNull()
      .default(sql`(current_timestamp)`),
    updated_at: text()
      .notNull()
      .default(sql`(current_timestamp)`)
      .$onUpdate(() => sql`(current_timestamp)`),
  },
  (t) => [index("files_user_id_idx").on(t.user_id)],
);

export const conversationsTable = sqliteTable("conversations_table", {
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
  conversation_id: int()
    .notNull()
    .references(() => conversationsTable.id, { onDelete: "cascade" }),
  content: text().notNull(),
  thinking: text(),
  tool_calls: text(),
  tool_name: text(),
  role: text().notNull(),
  created_at: text()
    .notNull()
    .default(sql`(current_timestamp)`),
  updated_at: text()
    .notNull()
    .default(sql`(current_timestamp)`)
    .$onUpdate(() => sql`(current_timestamp)`),
  images: text(),
  metadata: text(),
});

// AI SDK tables for the new v1 chat API
export const aiConversationsTable = sqliteTable(
  "ai_conversations",
  {
    id: int().primaryKey({ autoIncrement: true }),
    title: text().notNull(),
    provider: text().notNull(), // 'openai' | 'google' | 'anthropic' | 'ollama'
    model: text().notNull(),
    system_prompt: text(),
    user_id: text().notNull(),
    created_at: text()
      .notNull()
      .default(sql`(current_timestamp)`),
    updated_at: text()
      .notNull()
      .default(sql`(current_timestamp)`)
      .$onUpdate(() => sql`(current_timestamp)`),
  },
  (t) => [index("ai_conversations_user_id_idx").on(t.user_id)],
);

export const aiMessagesTable = sqliteTable(
  "ai_messages",
  {
    id: text().primaryKey().notNull(),
    conversation_id: int()
      .notNull()
      .references(() => aiConversationsTable.id, { onDelete: "cascade" }),
  role: text().notNull(), // 'user' | 'assistant' — from UIMessage.role
  message: text().notNull(), // JSON-serialized UIMessage from AI SDK
  metadata: text(), // JSON string for usage stats, finish reason, etc.
  created_at: int()
    .notNull()
    .default(sql`(unixepoch())`),
  },
  (t) => [index("ai_messages_conversation_id_idx").on(t.conversation_id)],
);
