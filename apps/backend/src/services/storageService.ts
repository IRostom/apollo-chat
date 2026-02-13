import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  type GetObjectCommandOutput,
  type ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let cachedClient: S3Client | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function buildEndpoint(): string | undefined {
  const endpoint = process.env.S3_ENDPOINT;
  if (!endpoint) return undefined;
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }
  const useSSL = parseBool(process.env.S3_USE_SSL, false);
  return `${useSSL ? "https" : "http"}://${endpoint}`;
}

export function getBucketName(): string {
  return requireEnv("S3_BUCKET");
}

export function getS3Client(): S3Client {
  if (cachedClient) return cachedClient;

  const accessKeyId = requireEnv("S3_ACCESS_KEY");
  const secretAccessKey = requireEnv("S3_SECRET_KEY");
  const region = process.env.S3_REGION || "us-east-1";
  const endpoint = buildEndpoint();
  const forcePathStyle = parseBool(process.env.S3_FORCE_PATH_STYLE, true);

  cachedClient = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return cachedClient;
}

export async function getPresignedUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const client = getS3Client();
  const bucket = getBucketName();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function getObject(key: string): Promise<GetObjectCommandOutput> {
  const client = getS3Client();
  const bucket = getBucketName();
  return client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
}

export async function listObjects(
  prefix?: string,
): Promise<ListObjectsV2CommandOutput> {
  const client = getS3Client();
  const bucket = getBucketName();
  return client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }),
  );
}
