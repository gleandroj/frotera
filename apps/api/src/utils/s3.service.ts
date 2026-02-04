import { PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class S3Service {
  private s3: S3Client;
  private bucket: string;

  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      endpoint: process.env.AWS_S3_ENDPOINT || undefined,
      forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === "true",
    });
    this.bucket = process.env.AWS_S3_BUCKET!;
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimetype: string,
    prefix = ""
  ): Promise<string> {
    const ext = originalName.split(".").pop();
    const key = prefix
      ? `${prefix.replace(/\/$/, "")}/${uuidv4()}.${ext}`
      : `${uuidv4()}.${ext}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
        ACL: "public-read",
      })
    );
    if (process.env.AWS_S3_ENDPOINT) {
      const endpoint = process.env.AWS_S3_ENDPOINT.replace(/\/$/, "");
      return `${endpoint}/${this.bucket}/${key}`;
    } else {
      return `https://${this.bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    }
  }

  async uploadFileFromDisk(
    filePath: string,
    originalName: string,
    mimetype: string,
    prefix = ""
  ): Promise<string> {
    const ext = originalName.split(".").pop();
    const key = prefix
      ? `${prefix.replace(/\/$/, "")}/${uuidv4()}.${ext}`
      : `${uuidv4()}.${ext}`;
    const fileStream = fs.createReadStream(filePath);
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileStream,
        ContentType: mimetype,
        ACL: "public-read",
      })
    );
    if (process.env.AWS_S3_ENDPOINT) {
      const endpoint = process.env.AWS_S3_ENDPOINT.replace(/\/$/, "");
      return `${endpoint}/${this.bucket}/${key}`;
    } else {
      return `https://${this.bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract the key from the URL
      let key: string;

      if (process.env.AWS_S3_ENDPOINT) {
        // For custom endpoints: http://endpoint/bucket/key
        const endpoint = process.env.AWS_S3_ENDPOINT.replace(/\/$/, "");
        const urlPattern = new RegExp(`${endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/${this.bucket}/(.+)`);
        const match = fileUrl.match(urlPattern);
        if (!match) {
          throw new Error(`Invalid S3 URL format: ${fileUrl}`);
        }
        key = match[1];
      } else {
        // For AWS S3: https://bucket.s3.region.amazonaws.com/key
        const urlPattern = new RegExp(`https://${this.bucket}\\.s3\\.[^/]+/(.+)`);
        const match = fileUrl.match(urlPattern);
        if (!match) {
          throw new Error(`Invalid S3 URL format: ${fileUrl}`);
        }
        key = match[1];
      }

      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
    } catch (error) {
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }
}
