import { api } from "encore.dev/api";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export interface ValidateBaselineRequest {
  screenId: string;
}

export interface ValidateBaselineResponse {
  valid: boolean;
  expectedHash: string;
  actualHash?: string;
  message: string;
  hasImage: boolean;
}

export const validate = api<ValidateBaselineRequest, ValidateBaselineResponse>(
  { expose: true, method: "POST", path: "/baselines/validate" },
  async (req) => {
    const manifestPath = path.join(process.cwd(), "baselines", "manifest.json");
    const manifestContent = await fs.readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent);

    const baseline = manifest.baselines.find(
      (b: { screenId: string }) => b.screenId === req.screenId
    );

    if (!baseline) {
      return {
        valid: false,
        expectedHash: "",
        message: "Baseline not found in manifest",
        hasImage: false,
      };
    }

    const screenPath = path.join(
      process.cwd(),
      "baselines",
      req.screenId,
      "screen.png"
    );

    try {
      await fs.access(screenPath);
      const imageData = await fs.readFile(screenPath);
      const actualHash = crypto.createHash("sha256").update(imageData).digest("hex");

      const isPlaceholder = baseline.hash.includes("placeholder");
      const hashesMatch = actualHash === baseline.hash;

      if (isPlaceholder) {
        return {
          valid: false,
          expectedHash: baseline.hash,
          actualHash,
          message: "Hash is a placeholder value",
          hasImage: true,
        };
      }

      if (hashesMatch) {
        return {
          valid: true,
          expectedHash: baseline.hash,
          actualHash,
          message: "Hash matches expected value",
          hasImage: true,
        };
      }

      return {
        valid: false,
        expectedHash: baseline.hash,
        actualHash,
        message: "Hash mismatch",
        hasImage: true,
      };
    } catch {
      return {
        valid: false,
        expectedHash: baseline.hash,
        message: "Image file not found",
        hasImage: false,
      };
    }
  }
);
