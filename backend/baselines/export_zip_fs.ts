import { api, Query } from "encore.dev/api";
import AdmZip from "adm-zip";
import fs from "fs/promises";
import path from "path";
import {
  readManifest,
  readScreenConfig,
  readBaselineImage,
  readPolicy,
} from "./filesystem";

const BASELINES_DIR = "/baselines";

export interface ExportZipParams {
  filter?: Query<"all" | "validated" | "invalid" | "missing">;
  search?: Query<string>;
}

export interface ExportZipResponse {
  zipData: string;
  filename: string;
}

async function validateBaseline(
  screenId: string,
  manifestEntry: any,
  screenConfig: any,
  imageBuffer: Buffer | null
): Promise<boolean> {
  if (!imageBuffer) {
    return false;
  }

  const tags = screenConfig?.tags || manifestEntry.tags || [];
  const masks = screenConfig?.masks || [];

  if (tags.includes("noisy") && masks.length === 0) {
    return false;
  }

  return true;
}

export const exportZipFs = api<ExportZipParams, ExportZipResponse>(
  { expose: true, method: "GET", path: "/baselines/export-zip-fs" },
  async (params) => {
    const zip = new AdmZip();
    const manifest = await readManifest();

    let filteredBaselines = manifest.baselines;

    if (params.filter && params.filter !== "all") {
      const filteredWithValidation = await Promise.all(
        manifest.baselines.map(async (entry) => {
          const screenConfig = await readScreenConfig(entry.screenId);
          const imageBuffer = await readBaselineImage(entry.screenId);
          const validated = await validateBaseline(entry.screenId, entry, screenConfig, imageBuffer);
          return { entry, validated, hasImage: !!imageBuffer };
        })
      );

      filteredBaselines = filteredWithValidation
        .filter(({ validated, hasImage }) => {
          if (params.filter === "validated") return validated;
          if (params.filter === "invalid") return hasImage && !validated;
          if (params.filter === "missing") return !hasImage;
          return true;
        })
        .map(({ entry }) => entry);
    }

    if (params.search) {
      const searchLower = params.search.toLowerCase();
      filteredBaselines = filteredBaselines.filter(
        (entry) =>
          entry.name.toLowerCase().includes(searchLower) ||
          entry.screenId.toLowerCase().includes(searchLower) ||
          (entry.url && entry.url.toLowerCase().includes(searchLower))
      );
    }

    const exportManifest = {
      ...manifest,
      baselines: filteredBaselines,
    };

    zip.addFile("baselines/manifest.json", Buffer.from(JSON.stringify(exportManifest, null, 2)));

    for (const entry of filteredBaselines) {
      const screenId = entry.screenId;
      const screenDir = path.join(BASELINES_DIR, screenId);

      const imageBuffer = await readBaselineImage(screenId);
      if (imageBuffer) {
        let imagePath = `baselines/${screenId}/baseline.png`;
        
        try {
          const files = await fs.readdir(screenDir);
          const imageFile = files.find(f => 
            f.match(/^baseline\.(png|jpg|jpeg|webp)$/i)
          );
          if (imageFile) {
            const ext = path.extname(imageFile);
            imagePath = `baselines/${screenId}/baseline${ext}`;
          }
        } catch {}

        zip.addFile(imagePath, imageBuffer);
      }

      const screenConfig = await readScreenConfig(screenId);
      if (screenConfig) {
        zip.addFile(
          `baselines/${screenId}/screen.json`,
          Buffer.from(JSON.stringify(screenConfig, null, 2))
        );
      }
    }

    const policy = await readPolicy();
    if (policy) {
      zip.addFile(".gate/policy.json", Buffer.from(JSON.stringify(policy, null, 2)));
    }

    const readmeContent = `# Baseline Export

This ZIP contains your visual regression test baselines.

## Structure

- baselines/manifest.json - Index of all baselines
- baselines/<screenId>/baseline.(png|jpg|jpeg|webp) - Baseline images
- baselines/<screenId>/screen.json - Screen-specific overrides (optional)
- .gate/policy.json - Organization-wide defaults (optional)

## Import Instructions

1. Extract this ZIP or use the Import ZIP feature in the Baseline Management UI
2. Toggle "Overwrite existing screen IDs" if you want to replace existing baselines
3. Toggle "Import .gate/policy.json if included" to import org-wide defaults
4. Commit changes to git to preserve version history

## Formats Supported

A) Repo bundle (current format):
   - Contains manifest.json with metadata
   - Each screen has its own directory with baseline image and optional screen.json

B) Flat images:
   - Place images at root level
   - Screen IDs will be inferred from filenames

Generated: ${new Date().toISOString()}
Filter: ${params.filter || "all"}
${params.search ? `Search: "${params.search}"` : ""}
Baselines exported: ${filteredBaselines.length}
`;

    zip.addFile("README.txt", Buffer.from(readmeContent));

    const zipBuffer = zip.toBuffer();
    const zipData = zipBuffer.toString("base64");

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const timeStr = now.toISOString().slice(11, 16).replace(/:/g, "");
    const filename = `baselines-export-${dateStr}-${timeStr}.zip`;

    return {
      zipData,
      filename,
    };
  }
);
