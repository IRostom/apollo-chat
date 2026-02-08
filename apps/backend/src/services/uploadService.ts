import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";
import { getBucketName, getS3Client } from "./storageService";

export interface UploadedFileInfo {
  key: string;
  bucket: string;
  size: number;
  contentType?: string;
  etag?: string;
}

type MulterS3File = Express.Multer.File & {
  key: string;
  bucket: string;
  etag?: string;
  contentType?: string;
  size: number;
};

function createObjectKey(originalName: string, fieldName: string): string {
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const ext = path.extname(originalName);
  return `${fieldName}-${uniqueSuffix}${ext}`;
}

function createStorage(): multer.StorageEngine {
  const s3 = getS3Client();
  const bucket = getBucketName();

  return multerS3({
    s3,
    bucket,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (
      req: Express.Request,
      file: Express.Multer.File,
      cb: (error: any, key?: string) => void,
    ) => {
      cb(null, createObjectKey(file.originalname, file.fieldname));
    },
  });
}

const upload = multer({
  storage: createStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

export const uploadSingle = upload.single("file");
export const uploadMultiple = upload.array("files", 5);

export function getUploadedFileInfo(
  file: Express.Multer.File,
): UploadedFileInfo {
  const s3File = file as MulterS3File;
  return {
    key: s3File.key,
    bucket: s3File.bucket,
    size: s3File.size,
    contentType: s3File.contentType,
    etag: s3File.etag,
  };
}

export function getUploadedFilesInfo(
  files: Express.Multer.File[],
): UploadedFileInfo[] {
  return files.map((file) => getUploadedFileInfo(file));
}
