import { api, APIError } from "encore.dev/api";
import { baselineImages } from "./storage";
import db from "../db";
import crypto from "crypto";
import AdmZip from "adm-zip";

export interface ImportZipRequest {
  zipData: string;
}

export interface ImportedBaseline {
  screenId: string;
  hash: string;
  size: number;
  status: string;
}

export interface ImportZipResponse {
  success: boolean;
  imported: ImportedBaseline[];
  errors: Array<{ screenId?: string; message: string }>;
  summary: {
    totalScreens: number;
    missingFiles: string[];
    duplicates: string[];
  };
}

const MAX_ZIP_SIZE = 50 * 1024 * 1024;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const importZip = api<ImportZipRequest, ImportZipResponse>(
  { expose: true, method: "POST", path: "/baselines/import-zip" },
  async (req) => {
    const zipBuffer = Buffer.from(req.zipData, "base64");
    
    if (zipBuffer.length > MAX_ZIP_SIZE) {
      throw APIError.invalidArgument(`ZIP file exceeds ${MAX_ZIP_SIZE / 1024 / 1024}MB limit`);
    }

    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    const imported: ImportedBaseline[] = [];
    const errors: Array<{ screenId?: string; message: string }> = [];
    const missingFiles: string[] = [];
    const duplicates: string[] = [];
    const seenIds = new Set<string>();

    let manifest: any = null;
    const screenConfigs = new Map<string, any>();

    for (const entry of zipEntries) {
      if (entry.entryName.endsWith("manifest.json")) {
        try {
          manifest = JSON.parse(entry.getData().toString("utf-8"));
        } catch (e) {
          errors.push({ message: "Failed to parse manifest.json" });
        }
      } else if (entry.entryName.endsWith("screen.json")) {
        const screenId = entry.entryName.split("/")[1];
        try {
          const config = JSON.parse(entry.getData().toString("utf-8"));
          screenConfigs.set(screenId, config);
        } catch (e) {
          errors.push({ screenId, message: "Failed to parse screen.json" });
        }
      }
    }

    if (!manifest || !manifest.baselines) {
      throw APIError.invalidArgument("ZIP must contain baselines/manifest.json with a 'baselines' array");
    }

    for (const baselineEntry of manifest.baselines) {
      const screenId = baselineEntry.screenId;

      if (seenIds.has(screenId)) {
        duplicates.push(screenId);
        continue;
      }
      seenIds.add(screenId);

      const possiblePaths = [
        `baselines/${screenId}/baseline.png`,
        `baselines/${screenId}/screen.png`,
        `${screenId}/baseline.png`,
        `${screenId}/screen.png`,
      ];

      let imageEntry = null;
      for (const path of possiblePaths) {
        imageEntry = zipEntries.find(e => e.entryName === path);
        if (imageEntry) break;
      }

      if (!imageEntry) {
        missingFiles.push(screenId);
        errors.push({ screenId, message: "Image file not found in ZIP" });
        continue;
      }

      try {
        const imageBuffer = imageEntry.getData();

        if (imageBuffer.length > MAX_FILE_SIZE) {
          errors.push({ screenId, message: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` });
          continue;
        }

        const hash = crypto.createHash("sha256").update(imageBuffer).digest("hex");
        const objectName = `${screenId}/${hash}.png`;

        const attrs = await baselineImages.upload(objectName, imageBuffer, {
          contentType: "image/png",
        });

        const screenConfig = screenConfigs.get(screenId);
        const tags = baselineEntry.tags || screenConfig?.tags || [];
        const masks = screenConfig?.masks || [];
        const thresholds = screenConfig?.thresholds || {};
        const route = baselineEntry.url || baselineEntry.route || screenConfig?.route || null;
        const name = baselineEntry.name || screenConfig?.name || screenId;
        const viewportWidth = screenConfig?.viewport?.width || 1280;
        const viewportHeight = screenConfig?.viewport?.height || 720;

        let status = "validated";
        let statusMessage: string | null = null;

        if (tags.includes("noisy") && masks.length === 0) {
          status = "invalid";
          statusMessage = "Baseline tagged as 'noisy' requires at least one mask";
        }

        await db.exec`
          INSERT INTO baselines (
            id, name, route, tags, viewport_width, viewport_height,
            hash, status, status_message, has_image, file_size, masks, thresholds
          ) VALUES (
            ${screenId},
            ${name},
            ${route},
            ${tags},
            ${viewportWidth},
            ${viewportHeight},
            ${hash},
            ${status},
            ${statusMessage},
            ${true},
            ${attrs.size},
            ${JSON.stringify(masks)},
            ${JSON.stringify(thresholds)}
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

        imported.push({
          screenId,
          hash,
          size: attrs.size,
          status,
        });
      } catch (error) {
        errors.push({
          screenId,
          message: error instanceof Error ? error.message : "Import failed",
        });
      }
    }

    return {
      success: errors.length === 0,
      imported,
      errors,
      summary: {
        totalScreens: manifest.baselines.length,
        missingFiles,
        duplicates,
      },
    };
  }
);
