import { api } from "encore.dev/api";
import { baselineImages } from "./storage";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

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

export const upload = api<UploadBaselineRequest, UploadBaselineResponse>(
  { expose: true, method: "POST", path: "/baselines/upload" },
  async (req) => {
    const imageBuffer = Buffer.from(req.imageData, "base64");
    const hash = crypto.createHash("sha256").update(imageBuffer).digest("hex");

    const objectName = `${req.screenId}/${hash}.png`;
    const attrs = await baselineImages.upload(objectName, imageBuffer, {
      contentType: "image/png",
    });

    const screenDir = path.join(process.cwd(), "baselines", req.screenId);
    await fs.mkdir(screenDir, { recursive: true });

    const localPath = path.join(screenDir, "screen.png");
    await fs.writeFile(localPath, imageBuffer);

    const manifestPath = path.join(process.cwd(), "baselines", "manifest.json");
    const manifestContent = await fs.readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent);

    const baselineIndex = manifest.baselines.findIndex(
      (b: { screenId: string }) => b.screenId === req.screenId
    );

    if (baselineIndex !== -1) {
      manifest.baselines[baselineIndex].hash = hash;
    }

    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const imageUrl = baselineImages.publicUrl(objectName);

    return {
      success: true,
      hash,
      imageUrl,
      size: attrs.size,
    };
  }
);
