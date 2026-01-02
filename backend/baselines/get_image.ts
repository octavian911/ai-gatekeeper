import { api } from "encore.dev/api";
import fs from "fs/promises";
import path from "path";

export interface GetImageRequest {
  screenId: string;
}

export interface GetImageResponse {
  imageData: string;
  hash: string;
}

export const getImage = api<GetImageRequest, GetImageResponse>(
  { expose: true, method: "GET", path: "/baselines/:screenId/image" },
  async (req) => {
    const screenPath = path.join(
      process.cwd(),
      "baselines",
      req.screenId,
      "screen.png"
    );

    const imageBuffer = await fs.readFile(screenPath);
    const imageData = imageBuffer.toString("base64");

    const manifestPath = path.join(process.cwd(), "baselines", "manifest.json");
    const manifestContent = await fs.readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent);

    const baseline = manifest.baselines.find(
      (b: { screenId: string }) => b.screenId === req.screenId
    );

    return {
      imageData,
      hash: baseline?.hash || "",
    };
  }
);
