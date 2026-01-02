import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const BASELINES_DIR = "/baselines";
const MANIFEST_PATH = path.join(BASELINES_DIR, "manifest.json");
const POLICY_PATH = "/.gate/policy.json";

export interface ManifestBaseline {
  screenId: string;
  name: string;
  url?: string;
  hash?: string;
  tags?: string[];
}

export interface Manifest {
  baselines: ManifestBaseline[];
}

export interface ScreenConfig {
  name?: string;
  url?: string;
  tags?: string[];
  viewport?: { width: number; height: number };
  masks?: Array<{ type: string; selector?: string; x?: number; y?: number; width?: number; height?: number }>;
  thresholds?: Record<string, any>;
}

export async function ensureBaselinesDir(): Promise<void> {
  try {
    await fs.access(BASELINES_DIR);
  } catch {
    await fs.mkdir(BASELINES_DIR, { recursive: true });
  }
}

export async function readManifest(): Promise<Manifest> {
  try {
    await ensureBaselinesDir();
    const data = await fs.readFile(MANIFEST_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return { baselines: [] };
  }
}

export async function writeManifest(manifest: Manifest): Promise<void> {
  await ensureBaselinesDir();
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
}

export async function readScreenConfig(screenId: string): Promise<ScreenConfig | null> {
  try {
    const configPath = path.join(BASELINES_DIR, screenId, "screen.json");
    const data = await fs.readFile(configPath, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function writeScreenConfig(screenId: string, config: ScreenConfig): Promise<void> {
  const screenDir = path.join(BASELINES_DIR, screenId);
  await fs.mkdir(screenDir, { recursive: true });
  const configPath = path.join(screenDir, "screen.json");
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export async function readBaselineImage(screenId: string): Promise<Buffer | null> {
  const screenDir = path.join(BASELINES_DIR, screenId);
  const extensions = ["png", "jpg", "jpeg", "webp"];
  
  for (const ext of extensions) {
    try {
      const imagePath = path.join(screenDir, `baseline.${ext}`);
      return await fs.readFile(imagePath);
    } catch {}
  }
  
  return null;
}

export async function writeBaselineImage(screenId: string, imageBuffer: Buffer): Promise<void> {
  const screenDir = path.join(BASELINES_DIR, screenId);
  await fs.mkdir(screenDir, { recursive: true });
  const imagePath = path.join(screenDir, "baseline.png");
  await fs.writeFile(imagePath, imageBuffer);
}

export async function deleteBaseline(screenId: string): Promise<void> {
  const screenDir = path.join(BASELINES_DIR, screenId);
  try {
    await fs.rm(screenDir, { recursive: true, force: true });
  } catch (error) {
    console.error(`Failed to delete baseline ${screenId}:`, error);
  }
}

export async function getImageHash(imageBuffer: Buffer): Promise<string> {
  return crypto.createHash("sha256").update(imageBuffer).digest("hex");
}

export async function getImageMtime(screenId: string): Promise<Date | null> {
  const screenDir = path.join(BASELINES_DIR, screenId);
  const extensions = ["png", "jpg", "jpeg", "webp"];
  
  for (const ext of extensions) {
    try {
      const imagePath = path.join(screenDir, `baseline.${ext}`);
      const stats = await fs.stat(imagePath);
      return stats.mtime;
    } catch {}
  }
  
  return null;
}

export async function readPolicy(): Promise<any | null> {
  try {
    const data = await fs.readFile(POLICY_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function writePolicy(policy: any): Promise<void> {
  const policyDir = path.dirname(POLICY_PATH);
  await fs.mkdir(policyDir, { recursive: true });
  await fs.writeFile(POLICY_PATH, JSON.stringify(policy, null, 2), "utf-8");
}
