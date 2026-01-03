import { api, APIError } from "encore.dev/api";
import {
  readManifest,
  writeManifest,
  writeBaselineImage,
  writeScreenConfig,
  getImageHash,
} from "./filesystem";

export interface BaselineInput {
  screenId: string;
  name: string;
  route?: string;
  tags?: string[];
  viewportWidth: number;
  viewportHeight: number;
  imageData: string;
}

export interface UploadMultiRequest {
  baselines: BaselineInput[];
}

export interface UploadedBaseline {
  screenId: string;
  hash: string;
  size: number;
}

export interface UploadMultiResponse {
  success: boolean;
  uploaded: UploadedBaseline[];
  errors: Array<{ screenId: string; message: string }>;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function validateImageSignature(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  
  const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  const isWEBP = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
                 buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  
  return isPNG || isJPEG || isWEBP;
}

export const uploadMultiFs = api<UploadMultiRequest, UploadMultiResponse>(
  { expose: true, method: "POST", path: "/baselines/upload-multi-fs" },
  async (req) => {
    const manifest = await readManifest();
    const uploaded: UploadedBaseline[] = [];
    const errors: Array<{ screenId: string; message: string }> = [];

    const existingIds = new Set(manifest.baselines.map((b) => b.screenId));
    const incomingIds = new Set<string>();

    for (const input of req.baselines) {
      if (incomingIds.has(input.screenId)) {
        errors.push({
          screenId: input.screenId,
          message: "Duplicate screen ID in upload batch",
        });
        continue;
      }
      incomingIds.add(input.screenId);

      try {
        const imageBuffer = Buffer.from(input.imageData, "base64");

        if (imageBuffer.length > MAX_FILE_SIZE) {
          errors.push({
            screenId: input.screenId,
            message: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
          });
          continue;
        }

        if (!validateImageSignature(imageBuffer)) {
          errors.push({
            screenId: input.screenId,
            message: "Expected: Rejected (file signature check), not just extension",
          });
          continue;
        }

        await writeBaselineImage(input.screenId, imageBuffer);

        const hash = await getImageHash(imageBuffer);

        const hasOverrides =
          input.tags && input.tags.length > 0;

        if (hasOverrides || input.viewportWidth !== 1280 || input.viewportHeight !== 720) {
          const screenConfig: any = {
            name: input.name,
          };

          if (input.route) {
            screenConfig.url = input.route;
          }

          if (input.tags && input.tags.length > 0) {
            screenConfig.tags = input.tags;
          }

          if (input.viewportWidth !== 1280 || input.viewportHeight !== 720) {
            screenConfig.viewport = {
              width: input.viewportWidth,
              height: input.viewportHeight,
            };
          }

          await writeScreenConfig(input.screenId, screenConfig);
        }

        if (!existingIds.has(input.screenId)) {
          manifest.baselines.push({
            screenId: input.screenId,
            name: input.name,
            url: input.route,
            hash,
            tags: input.tags,
          });
        } else {
          const existing = manifest.baselines.find((b) => b.screenId === input.screenId);
          if (existing) {
            existing.name = input.name;
            existing.url = input.route;
            existing.hash = hash;
            existing.tags = input.tags;
          }
        }

        uploaded.push({
          screenId: input.screenId,
          hash,
          size: imageBuffer.length,
        });
      } catch (error) {
        errors.push({
          screenId: input.screenId,
          message: error instanceof Error ? error.message : "Upload failed",
        });
      }
    }

    if (uploaded.length > 0) {
      await writeManifest(manifest);
    }

    return {
      success: errors.length === 0,
      uploaded,
      errors,
    };
  }
);
