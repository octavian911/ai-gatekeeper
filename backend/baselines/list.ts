import { api } from "encore.dev/api";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export interface BaselineMetadata {
  screenId: string;
  name: string;
  url: string;
  hash: string;
  tags?: string[];
  imageUrl?: string;
  hasImage: boolean;
  validated?: boolean;
  size?: number;
  uploadedAt?: string;
}

export interface ListBaselinesResponse {
  baselines: BaselineMetadata[];
}

export const list = api<void, ListBaselinesResponse>(
  { expose: true, method: "GET", path: "/baselines" },
  async () => {
    const manifestPath = path.join(process.cwd(), "baselines", "manifest.json");
    const manifestContent = await fs.readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent) as {
      baselines: Array<{
        screenId: string;
        name: string;
        url: string;
        hash: string;
        tags?: string[];
      }>;
    };

    const baselines: BaselineMetadata[] = await Promise.all(
      manifest.baselines.map(async (baseline) => {
        const screenPath = path.join(
          process.cwd(),
          "baselines",
          baseline.screenId,
          "screen.png"
        );

        let hasImage = false;
        let validated = false;
        let size: number | undefined;
        let actualHash: string | undefined;

        try {
          await fs.access(screenPath);
          hasImage = true;

          const stats = await fs.stat(screenPath);
          size = stats.size;

          const imageData = await fs.readFile(screenPath);
          actualHash = crypto.createHash("sha256").update(imageData).digest("hex");

          validated = actualHash === baseline.hash && !baseline.hash.includes("placeholder");
        } catch {
          hasImage = false;
        }

        return {
          ...baseline,
          hasImage,
          validated,
          size,
        };
      })
    );

    return { baselines };
  }
);
