import { api, APIError } from "encore.dev/api";
import { baselineImages } from "./storage";
import db from "../db";
import crypto from "crypto";

export interface BaselineInput {
  screenId: string;
  name: string;
  route?: string;
  tags?: string[];
  viewportWidth?: number;
  viewportHeight?: number;
  imageData: string;
  masks?: Array<{ type: string; selector?: string; x?: number; y?: number; width?: number; height?: number }>;
  thresholds?: Record<string, number>;
}

export interface UploadMultiRequest {
  baselines: BaselineInput[];
}

export interface UploadedBaseline {
  screenId: string;
  hash: string;
  size: number;
  status: string;
}

export interface UploadMultiResponse {
  success: boolean;
  uploaded: UploadedBaseline[];
  errors: Array<{ screenId: string; message: string }>;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const uploadMulti = api<UploadMultiRequest, UploadMultiResponse>(
  { expose: true, method: "POST", path: "/baselines/upload-multi" },
  async (req) => {
    const uploaded: UploadedBaseline[] = [];
    const errors: Array<{ screenId: string; message: string }> = [];

    for (const baseline of req.baselines) {
      try {
        const imageBuffer = Buffer.from(baseline.imageData, "base64");
        
        if (imageBuffer.length > MAX_FILE_SIZE) {
          errors.push({ screenId: baseline.screenId, message: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` });
          continue;
        }

        const hash = crypto.createHash("sha256").update(imageBuffer).digest("hex");
        const objectName = `${baseline.screenId}/${hash}.png`;
        
        const attrs = await baselineImages.upload(objectName, imageBuffer, {
          contentType: "image/png",
        });

        const tags = baseline.tags || [];
        let status = "validated";
        let statusMessage: string | null = null;

        if (tags.includes("noisy") && (!baseline.masks || baseline.masks.length === 0)) {
          status = "invalid";
          statusMessage = "Baseline tagged as 'noisy' requires at least one mask";
        }

        await db.exec`
          INSERT INTO baselines (
            id, name, route, tags, viewport_width, viewport_height, 
            hash, status, status_message, has_image, file_size, masks, thresholds
          ) VALUES (
            ${baseline.screenId},
            ${baseline.name},
            ${baseline.route || null},
            ${tags},
            ${baseline.viewportWidth || 1280},
            ${baseline.viewportHeight || 720},
            ${hash},
            ${status},
            ${statusMessage},
            ${true},
            ${attrs.size},
            ${JSON.stringify(baseline.masks || [])},
            ${JSON.stringify(baseline.thresholds || {})}
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            route = EXCLUDED.route,
            tags = EXCLUDED.tags,
            viewport_width = EXCLUDED.viewport_width,
            viewport_height = EXCLUDED.viewport_height,
            hash = EXCLUDED.hash,
            status = EXCLUDED.status,
            status_message = EXCLUDED.status_message,
            has_image = EXCLUDED.has_image,
            file_size = EXCLUDED.file_size,
            masks = EXCLUDED.masks,
            thresholds = EXCLUDED.thresholds,
            updated_at = NOW()
        `;

        uploaded.push({
          screenId: baseline.screenId,
          hash,
          size: attrs.size,
          status,
        });
      } catch (error) {
        errors.push({
          screenId: baseline.screenId,
          message: error instanceof Error ? error.message : "Upload failed",
        });
      }
    }

    return {
      success: errors.length === 0,
      uploaded,
      errors,
    };
  }
);
