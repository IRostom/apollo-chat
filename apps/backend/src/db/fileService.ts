import { db } from "./client";
import { filesTable } from "./schema";
import { and, eq } from "drizzle-orm";

export interface FileRecord {
  id: string;
  key: string;
  type?: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export const fileService = {
  async createFile(
    key: string,
    type: string | null | undefined,
    userId: string
  ): Promise<FileRecord> {
    const [file] = await db
      .insert(filesTable)
      .values({
        key,
        type,
        user_id: userId,
      })
      .returning();

    return file;
  },

  async getFileById(id: string, userId?: string): Promise<FileRecord | null> {
    const conditions = [eq(filesTable.id, id)];
    if (userId) {
      conditions.push(eq(filesTable.user_id, userId));
    }
    const file = await db
      .select()
      .from(filesTable)
      .where(and(...conditions))
      .limit(1);

    return file[0] || null;
  },

  async getAllFiles(userId: string): Promise<FileRecord[]> {
    return await db
      .select()
      .from(filesTable)
      .where(eq(filesTable.user_id, userId));
  },

  async deleteFileById(id: string, userId?: string): Promise<void> {
    const conditions = [eq(filesTable.id, id)];
    if (userId) {
      conditions.push(eq(filesTable.user_id, userId));
    }
    await db.delete(filesTable).where(and(...conditions));
  },
};
