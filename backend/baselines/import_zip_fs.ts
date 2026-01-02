import { api, APIError } from "encore.dev/api";
import AdmZip from "adm-zip";
import path from "path";
import {
  readManifest,
  writeManifest,
  writeBaselineImage,
  writeScreenConfig,
  writePolicy,
  getImageHash,
  readBaselineImage,
} from "./filesystem";

export interface ImportZipRequest {
  zipData: string;
  overwriteExisting: boolean;
  importPolicy: boolean;
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
  skipped: string[];
  errors: Array<{ screenId?: string; message: string }>;
  summary: {
    totalScreens: number;
    missingFiles: string[];
    duplicates: string[];
    hasPolicyFile: boolean;
  };
}

const MAX_ZIP_SIZE = 50 * 1024 * 1024;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function sanitizePath(filePath: string): string {
  const normalized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  return normalized;
}

export const importZipFs = api<ImportZipRequest, ImportZipResponse>(
  { expose: true, method: "POST", path: "/baselines/import-zip-fs" },
  async (req) => {
    const zipBuffer = Buffer.from(req.zipData, "base64");

    if (zipBuffer.length > MAX_ZIP_SIZE) {
      throw APIError.invalidArgument(
        `ZIP file exceeds ${MAX_ZIP_SIZE / 1024 / 1024}MB limit`
      );
    }

    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    const imported: ImportedBaseline[] = [];
    const skipped: string[] = [];
    const errors: Array<{ screenId?: string; message: string }> = [];
    const missingFiles: string[] = [];
    const duplicates: string[] = [];
    const seenIds = new Set<string>();

    let manifest: any = null;
    const screenConfigs = new Map<string, any>();
    const imageData = new Map<string, Buffer>();
    let policyData: any = null;
    let hasPolicyFile = false;

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;

      const safePath = sanitizePath(entry.entryName);

      if (safePath.includes("..")) {
        errors.push({ message: `Unsafe path detected: ${entry.entryName}` });
        continue;
      }

      if (safePath.endsWith("manifest.json")) {
        try {
          manifest = JSON.parse(entry.getData().toString("utf-8"));
        } catch (e) {
          errors.push({ message: "Failed to parse manifest.json" });
        }
      } else if (safePath.endsWith("screen.json")) {
        const parts = safePath.split("/");
        const screenId = parts[parts.length - 2];
        if (screenId) {
          try {
            const config = JSON.parse(entry.getData().toString("utf-8"));
            screenConfigs.set(screenId, config);
          } catch (e) {
            errors.push({ screenId, message: "Failed to parse screen.json" });
          }
        }
      } else if (safePath.endsWith(".png") || safePath.endsWith(".jpg") || safePath.endsWith(".jpeg")) {
        const parts = safePath.split("/");
        const filename = parts[parts.length - 1];
        const screenId = parts[parts.length - 2];

        if (screenId && (filename === "baseline.png" || filename === "screen.png")) {
          imageData.set(screenId, entry.getData());
        } else if (!screenId && filename.match(/\.(png|jpg|jpeg)$/i)) {
          const inferredId = filename.replace(/\.(png|jpg|jpeg)$/i, "");
          imageData.set(inferredId, entry.getData());
        }
      } else if (safePath.endsWith("policy.json") && safePath.includes(".gate")) {
        hasPolicyFile = true;
        try {
          policyData = JSON.parse(entry.getData().toString("utf-8"));
        } catch (e) {
          errors.push({ message: "Failed to parse policy.json" });
        }
      }
    }

    if (!manifest || !manifest.baselines) {
      if (imageData.size > 0) {
        manifest = {
          baselines: Array.from(imageData.keys()).map((screenId) => ({
            screenId,
            name: screenId,
          })),
        };
      } else {
        throw APIError.invalidArgument(
          "ZIP must contain baselines/manifest.json or flat image files"
        );
      }
    }

    const currentManifest = await readManifest();
    const existingIds = new Set(currentManifest.baselines.map((b) => b.screenId));

    for (const baselineEntry of manifest.baselines) {
      const screenId = baselineEntry.screenId;

      if (seenIds.has(screenId)) {
        duplicates.push(screenId);
        continue;
      }
      seenIds.add(screenId);

      const imageBuffer = imageData.get(screenId);

      if (!imageBuffer) {
        missingFiles.push(screenId);
        errors.push({ screenId, message: "Image file not found in ZIP" });
        continue;
      }

      if (existingIds.has(screenId) && !req.overwriteExisting) {
        skipped.push(screenId);
        continue;
      }

      try {
        if (imageBuffer.length > MAX_FILE_SIZE) {
          errors.push({
            screenId,
            message: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
          });
          continue;
        }

        await writeBaselineImage(screenId, imageBuffer);

        const hash = await getImageHash(imageBuffer);

        const screenConfig = screenConfigs.get(screenId);
        if (screenConfig) {
          await writeScreenConfig(screenId, screenConfig);
        }

        const tags = screenConfig?.tags || baselineEntry.tags || [];
        const masks = screenConfig?.masks || [];
        let status = "validated";

        if (tags.includes("noisy") && masks.length === 0) {
          status = "invalid";
        }

        if (!existingIds.has(screenId)) {
          currentManifest.baselines.push({
            screenId,
            name: baselineEntry.name || screenId,
            url: baselineEntry.url || baselineEntry.route,
            hash,
            tags,
          });
        } else {
          const existing = currentManifest.baselines.find((b) => b.screenId === screenId);
          if (existing) {
            existing.name = baselineEntry.name || existing.name;
            existing.url = baselineEntry.url || baselineEntry.route || existing.url;
            existing.hash = hash;
            existing.tags = tags;
          }
        }

        imported.push({
          screenId,
          hash,
          size: imageBuffer.length,
          status,
        });
      } catch (error) {
        errors.push({
          screenId,
          message: error instanceof Error ? error.message : "Import failed",
        });
      }
    }

    if (imported.length > 0 || skipped.length > 0) {
      await writeManifest(currentManifest);
    }

    if (policyData && req.importPolicy) {
      await writePolicy(policyData);
    }

    return {
      success: errors.length === 0,
      imported,
      skipped,
      errors,
      summary: {
        totalScreens: manifest.baselines.length,
        missingFiles,
        duplicates,
        hasPolicyFile,
      },
    };
  }
);
