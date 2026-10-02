import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageConfig {
  region?: string;
  endpoint?: string; // Optional custom endpoint for Cloudflare R2 / MinIO
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
}

export class StorageService {
  private static instance: StorageService;
  private s3Client: S3Client | null = null;
  private defaultBucket: string;

  private constructor() {
    const region = process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1';
    const endpoint = process.env.AWS_S3_ENDPOINT || process.env.S3_ENDPOINT;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;
    this.defaultBucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || 'talentpulse-media-assets';

    if (accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region,
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    }
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Helper path generators for standardized object key structures
   */
  public getAvatarKey(userId: string): string {
    return `avatars/${userId}.jpg`;
  }

  public getResumeKey(candidateId: string, fileUuid: string): string {
    return `resumes/${candidateId}/${fileUuid}.pdf`;
  }

  public getRecordingKey(sessionId: string): string {
    return `recordings/${sessionId}/full_interview.mp4`;
  }

  public getAudioSnippetKey(sessionId: string, turnIndex: number): string {
    return `audio/${sessionId}/turn_${turnIndex}.webm`;
  }

  /**
   * Generates a presigned URL for PUT uploading to S3 or Cloudflare R2
   */
  public async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    bucket: string = this.defaultBucket,
    expiresInSec: number = 300
  ): Promise<{ uploadUrl: string; fileKey: string; publicUrl: string }> {
    const publicBase = process.env.PUBLIC_STORAGE_BASE_URL || `https://${bucket}.s3.amazonaws.com`;
    const publicUrl = `${publicBase}/${key}`;

    if (!this.s3Client) {
      // Mock mode fallback for local dev / offline testing
      return {
        uploadUrl: `https://mock-storage.talentpulse.ai/upload/${bucket}/${key}?expires=${expiresInSec}`,
        fileKey: key,
        publicUrl,
      };
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSec });
    return {
      uploadUrl,
      fileKey: key,
      publicUrl,
    };
  }

  /**
   * Generates a presigned URL for GET downloading from S3 or Cloudflare R2
   */
  public async generatePresignedDownloadUrl(
    key: string,
    bucket: string = this.defaultBucket,
    expiresInSec: number = 3600
  ): Promise<string> {
    if (!this.s3Client) {
      const publicBase = process.env.PUBLIC_STORAGE_BASE_URL || `https://${bucket}.s3.amazonaws.com`;
      return `${publicBase}/${key}`;
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSec });
  }
}

export const storageService = StorageService.getInstance();
