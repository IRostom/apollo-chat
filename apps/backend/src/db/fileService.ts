import { db } from "./client";
import { filesTable } from "./schema";
import { eq } from "drizzle-orm";

export interface FileRecord {
  id: string;
  key: string;
  type?: string | null;
  created_at: string;
  updated_at: string;
}

export const fileService = {
  async createFile(key: string, type?: string | null): Promise<FileRecord> {
    const [file] = await db
      .insert(filesTable)
      .values({
        key,
        type,
      })
      .returning();

    return file;
  },

  async getFileById(id: string): Promise<FileRecord | null> {
    const file = await db
      .select()
      .from(filesTable)
      .where(eq(filesTable.id, id))
      .limit(1);

    return file[0] || null;
  },

  async getAllFiles(): Promise<FileRecord[]> {
    return await db.select().from(filesTable);
  },

  async deleteFileById(id: string): Promise<void> {
    await db.delete(filesTable).where(eq(filesTable.id, id));
  },
};
