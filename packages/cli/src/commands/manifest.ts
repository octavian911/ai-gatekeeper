import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs/promises';
import { z } from 'zod';

const BASELINES_DIR = path.resolve(process.cwd(), 'baselines');
const MANIFEST_PATH = path.join(BASELINES_DIR, 'manifest.json');
const MANIFEST_BACKUP_PATH = path.join(BASELINES_DIR, 'manifest.backup.json');
const MANIFEST_BACKUP_DIR = path.join(BASELINES_DIR, '.backups');

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

function validateManifest(data: any): { valid: boolean; errors?: string[] } {
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
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

async function tryRestoreFromBackup(): Promise<{ recovered: boolean; message: string; source?: string; baselines?: number } | null> {
  try {
    const backupData = await fs.readFile(MANIFEST_BACKUP_PATH, 'utf-8');
    const parsed = JSON.parse(backupData);
    const validation = validateManifest(parsed);
    
    if (validation.valid) {
      await fs.copyFile(MANIFEST_BACKUP_PATH, MANIFEST_PATH);
      return {
        recovered: true,
        message: 'Manifest recovered from manifest.backup.json',
        source: 'manifest.backup.json',
        baselines: parsed.baselines.length,
      };
    }
  } catch {}
  
  return null;
}

async function tryRestoreFromTimestampedBackups(): Promise<{ recovered: boolean; message: string; source?: string; baselines?: number } | null> {
  try {
    const files = await fs.readdir(MANIFEST_BACKUP_DIR);
    const backups = files
      .filter(f => f.startsWith('manifest.') && f.endsWith('.backup.json'))
      .map(f => path.join(MANIFEST_BACKUP_DIR, f));
    
    const stats = await Promise.all(
      backups.map(async b => ({
        path: b,
        mtime: (await fs.stat(b)).mtime,
      }))
    );
    
    stats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    
    for (const backup of stats) {
      try {
        const data = await fs.readFile(backup.path, 'utf-8');
        const parsed = JSON.parse(data);
        const validation = validateManifest(parsed);
        
        if (validation.valid) {
          await fs.copyFile(backup.path, MANIFEST_PATH);
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

async function rebuildFromFilesystem(): Promise<{ recovered: boolean; message: string; source?: string; baselines?: number }> {
  const baselines: Array<{ screenId: string; name: string }> = [];
  
  try {
    const entries = await fs.readdir(BASELINES_DIR, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const screenId = entry.name;
        const screenDir = path.join(BASELINES_DIR, screenId);
        
        const extensions = ['png', 'jpg', 'jpeg', 'webp'];
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
      message: `Failed to scan filesystem: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
  
  if (baselines.length === 0) {
    return {
      recovered: false,
      message: 'No baselines found in filesystem to rebuild from',
    };
  }
  
  const manifest = { baselines };
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
  
  return {
    recovered: true,
    message: `Manifest rebuilt from filesystem (${baselines.length} baselines found)`,
    source: 'filesystem scan',
    baselines: baselines.length,
  };
}

export const manifestCommand = new Command('manifest')
  .description('Manage manifest.json');

manifestCommand
  .command('recover')
  .description('Recover corrupted manifest.json from backups or filesystem')
  .action(async () => {
    console.log(chalk.bold('\n🔍 Checking manifest integrity...\n'));
    
    try {
      const data = await fs.readFile(MANIFEST_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      const validation = validateManifest(parsed);
      
      if (validation.valid) {
        console.log(chalk.green('✅ Manifest is valid. No recovery needed.'));
        console.log(chalk.dim(`   Baselines: ${parsed.baselines.length}\n`));
        return;
      } else {
        console.log(chalk.red('❌ Manifest validation failed:'));
        validation.errors?.forEach(err => console.log(chalk.red(`   - ${err}`)));
        console.log();
      }
    } catch (error) {
      console.log(chalk.red('❌ Manifest is corrupted or missing\n'));
    }
    
    const spinner = ora('Attempting recovery...').start();
    
    spinner.text = '1. Trying manifest.backup.json...';
    let result = await tryRestoreFromBackup();
    if (result) {
      spinner.succeed(chalk.green(`✅ ${result.message}`));
      console.log(chalk.dim(`   Baselines: ${result.baselines}\n`));
      return;
    }
    spinner.info(chalk.dim('   Not available or invalid'));
    
    spinner.start('2. Trying timestamped backups...');
    result = await tryRestoreFromTimestampedBackups();
    if (result) {
      spinner.succeed(chalk.green(`✅ ${result.message}`));
      console.log(chalk.dim(`   Baselines: ${result.baselines}\n`));
      return;
    }
    spinner.info(chalk.dim('   No valid backups found'));
    
    spinner.start('3. Rebuilding from filesystem...');
    result = await rebuildFromFilesystem();
    
    if (result.recovered) {
      spinner.succeed(chalk.green(`✅ ${result.message}`));
      console.log(chalk.dim(`   Baselines: ${result.baselines}\n`));
    } else {
      spinner.fail(chalk.red(`❌ ${result.message}\n`));
      process.exit(1);
    }
  });

manifestCommand
  .command('validate')
  .description('Validate manifest.json schema')
  .action(async () => {
    const spinner = ora('Validating manifest...').start();
    
    try {
      const data = await fs.readFile(MANIFEST_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      const validation = validateManifest(parsed);
      
      if (validation.valid) {
        spinner.succeed(chalk.green('✅ Manifest is valid'));
        console.log(chalk.dim(`   Baselines: ${parsed.baselines.length}\n`));
      } else {
        spinner.fail(chalk.red('❌ Manifest validation failed'));
        validation.errors?.forEach(err => console.log(chalk.red(`   - ${err}`)));
        console.log();
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red('❌ Failed to read or parse manifest'));
      console.log(chalk.red(`   ${error instanceof Error ? error.message : 'Unknown error'}\n`));
      process.exit(1);
    }
  });
