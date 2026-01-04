import fs from "fs/promises";
import path from "path";
import { api } from "encore.dev/api";
import { validateManifest, getBaselinesDir } from "./filesystem";

function getManifestPath(): string {
  return path.join(getBaselinesDir(), "manifest.json");
}

function getManifestBackupPath(): string {
  return path.join(getBaselinesDir(), "manifest.backup.json");
}

function getManifestBackupDir(): string {
  return path.join(getBaselinesDir(), ".backups");
}

interface RecoverManifestResponse {
  recovered: boolean;
  message: string;
  source?: string;
  baselines?: number;
}

async function tryRestoreFromBackup(): Promise<RecoverManifestResponse | null> {
  try {
    const backupPath = getManifestBackupPath();
    const manifestPath = getManifestPath();
    const backupData = await fs.readFile(backupPath, "utf-8");
    const parsed = JSON.parse(backupData);
    const validation = validateManifest(parsed);
    
    if (validation.valid) {
      await fs.copyFile(backupPath, manifestPath);
      return {
        recovered: true,
        message: "Manifest recovered from manifest.backup.json",
        source: "manifest.backup.json",
        baselines: parsed.baselines.length,
      };
    }
  } catch {}
  
  return null;
}

async function tryRestoreFromTimestampedBackups(): Promise<RecoverManifestResponse | null> {
  try {
    const backupDir = getManifestBackupDir();
    const manifestPath = getManifestPath();
    const files = await fs.readdir(backupDir);
    const backups = files
      .filter(f => f.startsWith("manifest.") && f.endsWith(".backup.json"))
      .map(f => path.join(backupDir, f));
    
    const stats = await Promise.all(
      backups.map(async b => ({
        path: b,
        mtime: (await fs.stat(b)).mtime,
      }))
    );
    
    stats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    
    for (const backup of stats) {
      try {
        const data = await fs.readFile(backup.path, "utf-8");
        const parsed = JSON.parse(data);
        const validation = validateManifest(parsed);
        
        if (validation.valid) {
          await fs.copyFile(backup.path, manifestPath);
          return {
            recovered: true,
            message: `Manifest recovered from ${path.basename(backup.path)}`,
            source: path.basename(backup.path),
            baselines: parsed.baselines.length,
          };
        }
      } catch {}
    }
  } catch {}
  
  return null;
}

async function rebuildFromFilesystem(): Promise<RecoverManifestResponse> {
  const baselines: Array<{ screenId: string; name: string }> = [];
  
  const baselinesDir = getBaselinesDir();
  
  try {
    const entries = await fs.readdir(baselinesDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const screenId = entry.name;
        const screenDir = path.join(baselinesDir, screenId);
        
        const extensions = ["png", "jpg", "jpeg", "webp"];
        let hasImage = false;
        
        for (const ext of extensions) {
          try {
            await fs.access(path.join(screenDir, `baseline.${ext}`));
            hasImage = true;
            break;
          } catch {}
        }
        
        if (hasImage) {
          baselines.push({
            screenId,
            name: screenId,
          });
        }
      }
    }
  } catch (error) {
    return {
      recovered: false,
      message: `Failed to scan filesystem: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
  
  if (baselines.length === 0) {
    return {
      recovered: false,
      message: "No baselines found in filesystem to rebuild from",
    };
  }
  
  const manifest = { baselines };
  const manifestPath = getManifestPath();
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  
  return {
    recovered: true,
    message: `Manifest rebuilt from filesystem (${baselines.length} baselines found)`,
    source: "filesystem scan",
    baselines: baselines.length,
  };
}

export const recoverManifest = api<void, RecoverManifestResponse>(
  { expose: true, method: "POST", path: "/baselines/recover-manifest" },
  async () => {
    let result = await tryRestoreFromBackup();
    if (result) return result;
    
    result = await tryRestoreFromTimestampedBackups();
    if (result) return result;
    
    return await rebuildFromFilesystem();
  }
);

export async function recoverManifestCLI(): Promise<RecoverManifestResponse> {
  console.log("🔍 Checking manifest integrity...");
  
  const manifestPath = getManifestPath();
  
  try {
    const data = await fs.readFile(manifestPath, "utf-8");
    const parsed = JSON.parse(data);
    const validation = validateManifest(parsed);
    
    if (validation.valid) {
      return {
        recovered: false,
        message: "Manifest is valid. No recovery needed.",
        baselines: parsed.baselines.length,
      };
    } else {
      console.log("❌ Manifest validation failed:", validation.errors);
    }
  } catch (error) {
    console.log("❌ Manifest is corrupted or missing");
  }
  
  console.log("🔄 Attempting recovery...\n");
  
  console.log("1. Trying manifest.backup.json...");
  let result = await tryRestoreFromBackup();
  if (result) {
    console.log(`✅ ${result.message}`);
    return result;
  }
  console.log("   Not available or invalid\n");
  
  console.log("2. Trying timestamped backups...");
  result = await tryRestoreFromTimestampedBackups();
  if (result) {
    console.log(`✅ ${result.message}`);
    return result;
  }
  console.log("   No valid backups found\n");
  
  console.log("3. Rebuilding from filesystem...");
  result = await rebuildFromFilesystem();
  console.log(`${result.recovered ? "✅" : "❌"} ${result.message}`);
  
  return result;
}
