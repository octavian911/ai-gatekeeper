import { api, APIError } from "encore.dev/api";
import { baselineImages } from "./storage";
import db from "../db";
import crypto from "crypto";

export interface UploadBaselineRequest {
  screenId: string;
  imageData: string;
}

export interface UploadBaselineResponse {
  success: boolean;
  hash: string;
  imageUrl: string;
  size: number;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const upload = api<UploadBaselineRequest, UploadBaselineResponse>(
  { expose: true, method: "POST", path: "/baselines/upload" },
  async (req) => {
    const imageBuffer = Buffer.from(req.imageData, "base64");
    
    if (imageBuffer.length > MAX_FILE_SIZE) {
      throw APIError.invalidArgument(`File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
    }

    const hash = crypto.createHash("sha256").update(imageBuffer).digest("hex");
    const objectName = `${req.screenId}/${hash}.png`;
    const attrs = await baselineImages.upload(objectName, imageBuffer, {
      contentType: "image/png",
    });

    await db.exec`
      UPDATE baselines
      SET hash = ${hash}, 
          has_image = ${true}, 
          file_size = ${attrs.size},
          status = 'validated',
          status_message = NULL,
          updated_at = NOW()
      WHERE id = ${req.screenId}
    `;

    const imageUrl = baselineImages.publicUrl(objectName);

    return {
      success: true,
      hash,
      imageUrl,
      size: attrs.size,
    };
  }
);
