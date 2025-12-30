import { db } from "./client";
import { filesTable } from "./schema";
import { eq } from "drizzle-orm";

export interface FileRecord {
  id: number;
  filename: string;
  path: string;
  type?: string | null;
  created_at: string;
  updated_at: string;
}

export const fileService = {
  async createFile(
    filename: string,
    path: string,
    type?: string | null,
  ): Promise<FileRecord> {
    // Store relative path in database
    const uploadDir = "../../uploads/";
    const relativePath = path.replace(uploadDir, "");

    const [file] = await db
      .insert(filesTable)
      .values({
        filename,
        path: relativePath,
        type,
      })
      .returning();

    return file;
  },

  async getFileById(id: number): Promise<FileRecord | null> {
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

  async deleteFileById(id: number): Promise<void> {
    await db.delete(filesTable).where(eq(filesTable.id, id));
  },
};
