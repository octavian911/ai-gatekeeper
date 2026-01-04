import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { z } from "zod";

const MAX_BACKUPS = 5;
const POLICY_PATH = "/.gate/policy.json";

export function getBaselinesDir(): string {
  let resolved: string;
  
  if (process.env.AI_GATE_BASELINES_DIR) {
    resolved = path.resolve(process.env.AI_GATE_BASELINES_DIR);
  } else {
    resolved = path.join(process.cwd(), ".ai-gate", "baselines");
  }
  
  if (resolved === "/baselines" || resolved.startsWith("/baselines/")) {
    resolved = path.join(process.cwd(), ".ai-gate", "baselines");
  }
  
  return resolved;
}

function getManifestPath(): string {
  return path.join(getBaselinesDir(), "manifest.json");
}

function getManifestBackupDir(): string {
  return path.join(getBaselinesDir(), ".backups");
}

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
  const dir = getBaselinesDir();
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

function deduplicateBaselines(baselines: ManifestBaseline[]): ManifestBaseline[] {
  const map = new Map<string, ManifestBaseline>();
  for (const baseline of baselines) {
    map.set(baseline.screenId, baseline);
  }
  return Array.from(map.values());
}

export async function readManifest(): Promise<Manifest> {
  try {
    await ensureBaselinesDir();
    const manifestPath = getManifestPath();
    const data = await fs.readFile(manifestPath, "utf-8");
    const parsed = JSON.parse(data);
    
    const validation = validateManifest(parsed);
    if (!validation.valid) {
      console.error("Manifest validation failed:", validation.errors);
      throw new Error(`Manifest corrupted: ${validation.errors?.join(", ")}`);
    }
    
    parsed.baselines = deduplicateBaselines(parsed.baselines);
    
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Manifest corrupted")) {
      throw error;
    }
    return { baselines: [] };
  }
}

async function ensureBackupDir(): Promise<void> {
  const backupDir = getManifestBackupDir();
  try {
    await fs.access(backupDir);
  } catch {
    await fs.mkdir(backupDir, { recursive: true });
  }
}

async function rotateBackups(): Promise<void> {
  await ensureBackupDir();
  
  const backupDir = getManifestBackupDir();
  
  try {
    const files = await fs.readdir(backupDir);
    const backups = files
      .filter(f => f.startsWith("manifest.") && f.endsWith(".backup.json"))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
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
  
  const manifestPath = getManifestPath();
  const backupDir = getManifestBackupDir();
  const baselinesDir = getBaselinesDir();
  
  manifest.baselines = deduplicateBaselines(manifest.baselines);
  
  const validation = validateManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Invalid manifest: ${validation.errors?.join(", ")}`);
  }
  
  try {
    await fs.access(manifestPath);
    await ensureBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `manifest.${timestamp}.backup.json`);
    await fs.copyFile(manifestPath, backupPath);
    await rotateBackups();
    
    const lastBackupPath = path.join(baselinesDir, "manifest.backup.json");
    await fs.copyFile(manifestPath, lastBackupPath).catch(() => {});
  } catch {}
  
  const tempPath = `${manifestPath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(manifest, null, 2), "utf-8");
  await fs.rename(tempPath, manifestPath);
}

export async function readScreenConfig(screenId: string): Promise<ScreenConfig | null> {
  try {
    const baselinesDir = getBaselinesDir();
    const configPath = path.join(baselinesDir, screenId, "screen.json");
    const data = await fs.readFile(configPath, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function writeScreenConfig(screenId: string, config: ScreenConfig): Promise<void> {
  const baselinesDir = getBaselinesDir();
  const screenDir = path.join(baselinesDir, screenId);
  await fs.mkdir(screenDir, { recursive: true });
  const configPath = path.join(screenDir, "screen.json");
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export async function readBaselineImage(screenId: string): Promise<Buffer | null> {
  const baselinesDir = getBaselinesDir();
  const screenDir = path.join(baselinesDir, screenId);
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
  const baselinesDir = getBaselinesDir();
  const screenDir = path.join(baselinesDir, screenId);
  await fs.mkdir(screenDir, { recursive: true });
  const imagePath = path.join(screenDir, "baseline.png");
  await fs.writeFile(imagePath, imageBuffer);
}

export async function deleteBaseline(screenId: string): Promise<void> {
  const baselinesDir = getBaselinesDir();
  const screenDir = path.join(baselinesDir, screenId);
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
  const baselinesDir = getBaselinesDir();
  const screenDir = path.join(baselinesDir, screenId);
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
