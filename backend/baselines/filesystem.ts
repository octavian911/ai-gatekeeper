import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { z } from "zod";

const BASELINES_DIR = "/baselines";
const MANIFEST_PATH = path.join(BASELINES_DIR, "manifest.json");
const MANIFEST_BACKUP_DIR = path.join(BASELINES_DIR, ".backups");
const POLICY_PATH = "/.gate/policy.json";
const MAX_BACKUPS = 5;

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

const ManifestBaselineSchema = z.object({
  screenId: z.string().min(1),
  name: z.string().min(1),
  url: z.string().optional(),
  hash: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const ManifestSchema = z.object({
  baselines: z.array(ManifestBaselineSchema),
});

export function validateManifest(data: any): { valid: boolean; errors?: string[] } {
  try {
    ManifestSchema.parse(data);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ["Unknown validation error"] };
  }
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
    const parsed = JSON.parse(data);
    
    const validation = validateManifest(parsed);
    if (!validation.valid) {
      console.error("Manifest validation failed:", validation.errors);
      throw new Error(`Manifest corrupted: ${validation.errors?.join(", ")}`);
    }
    
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Manifest corrupted")) {
      throw error;
    }
    return { baselines: [] };
  }
}

async function ensureBackupDir(): Promise<void> {
  try {
    await fs.access(MANIFEST_BACKUP_DIR);
  } catch {
    await fs.mkdir(MANIFEST_BACKUP_DIR, { recursive: true });
  }
}

async function rotateBackups(): Promise<void> {
  await ensureBackupDir();
  
  try {
    const files = await fs.readdir(MANIFEST_BACKUP_DIR);
    const backups = files
      .filter(f => f.startsWith("manifest.") && f.endsWith(".backup.json"))
      .map(f => ({
        name: f,
        path: path.join(MANIFEST_BACKUP_DIR, f),
      }));
    
    const stats = await Promise.all(
      backups.map(async b => ({
        ...b,
        mtime: (await fs.stat(b.path)).mtime,
      }))
    );
    
    stats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    
    if (stats.length >= MAX_BACKUPS) {
      const toDelete = stats.slice(MAX_BACKUPS - 1);
      await Promise.all(toDelete.map(b => fs.rm(b.path, { force: true })));
    }
  } catch (error) {
    console.error("Failed to rotate backups:", error);
  }
}

export async function writeManifest(manifest: Manifest): Promise<void> {
  await ensureBaselinesDir();
  
  const validation = validateManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Invalid manifest: ${validation.errors?.join(", ")}`);
  }
  
  try {
    await fs.access(MANIFEST_PATH);
    await ensureBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(MANIFEST_BACKUP_DIR, `manifest.${timestamp}.backup.json`);
    await fs.copyFile(MANIFEST_PATH, backupPath);
    await rotateBackups();
    
    const lastBackupPath = path.join(BASELINES_DIR, "manifest.backup.json");
    await fs.copyFile(MANIFEST_PATH, lastBackupPath).catch(() => {});
  } catch {}
  
  const tempPath = `${MANIFEST_PATH}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(manifest, null, 2), "utf-8");
  await fs.rename(tempPath, MANIFEST_PATH);
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
