import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import {
  ScreenshotEngine,
  BaselineManager,
  type RouteConfig,
  type ScreenBaseline,
  type Mask,
  type ViewportConfig,
  type ScreenThresholds,
} from '@ai-gate/core';
import { loadConfig } from '../config.js';

interface ManifestEntry {
  screenId: string;
  name: string;
  url: string;
  hash: string;
  tags?: string[];
}

interface Manifest {
  baselines: ManifestEntry[];
}

interface ScreenMetadata {
  screens: Record<string, {
    name: string;
    url: string;
    tags?: string[];
    viewport?: Partial<ViewportConfig>;
    thresholds?: Partial<ScreenThresholds>;
    masks?: Mask[];
  }>;
}

function generateScreenId(filename: string, providedId?: string): string {
  if (providedId) return providedId;
  const baseName = path.basename(filename, path.extname(filename));
  return baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function computeHash(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

export const baselineCommand = new Command('baseline')
  .description('Manage baseline screenshots')
  .addHelpText('after', `
Examples:
  $ pnpm gate baseline add --from ./screenshots
  $ pnpm gate baseline add --from ./screenshots --meta screens.json
  $ pnpm gate baseline list
  $ pnpm gate baseline validate --check-hash
  $ pnpm gate baseline update --baseURL http://localhost:5173
  $ pnpm gate baseline update --baseURL http://localhost:5173 --changedOnly

Documentation: https://github.com/YOUR_ORG/ai-output-gate#baseline-management`);

baselineCommand
  .command('add')
  .description('Capture new baseline screenshots or import from PNG folder')
  .option('-r, --route <route>', 'Capture specific route only')
  .option('--from <folder>', 'Import baselines from PNG folder')
  .option('--meta <file>', 'JSON file with screen metadata (use with --from)')
  .option('--out <dir>', 'Output directory for baselines (default: baselines)', 'baselines')
  .addHelpText('after', `
Examples:
  Import from folder:
    $ pnpm gate baseline add --from ./screenshots
    $ pnpm gate baseline add --from ./screenshots --meta screens.json

  Capture from running app (requires config):
    $ pnpm gate baseline add
    $ pnpm gate baseline add --route /dashboard`)
  .action(async (options) => {
    if (options.from) {
      const spinner = ora('Importing baselines from folder...').start();
      
      try {
        const fromDir = path.resolve(process.cwd(), options.from);
        const outDir = path.resolve(process.cwd(), options.out);
        const manifestPath = path.join(outDir, 'manifest.json');
        
        await fs.mkdir(outDir, { recursive: true });
        
        let manifest: Manifest = { baselines: [] };
        try {
          const manifestData = await fs.readFile(manifestPath, 'utf-8');
          manifest = JSON.parse(manifestData);
        } catch {
        }
        
        let metadata: ScreenMetadata | null = null;
        if (options.meta) {
          const metaPath = path.resolve(process.cwd(), options.meta);
          const metaData = await fs.readFile(metaPath, 'utf-8');
          metadata = JSON.parse(metaData);
        }
        
        const files = await fs.readdir(fromDir);
        const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png'));
        
        if (pngFiles.length === 0) {
          spinner.fail(`No PNG files found in ${chalk.cyan(fromDir)}`);
          console.error(chalk.red('\nError: The specified folder contains no .png files.'));
          console.error(chalk.dim('\nTip: Ensure the folder contains baseline screenshots in PNG format.'));
          process.exit(1);
        }
        
        let added = 0;
        let updated = 0;
        
        for (const file of pngFiles) {
          const sourcePath = path.join(fromDir, file);
          const screenId = generateScreenId(file);
          const screenDir = path.join(outDir, screenId);
          const baselinePath = path.join(screenDir, 'baseline.png');
          const screenJsonPath = path.join(screenDir, 'screen.json');
          
          await fs.mkdir(screenDir, { recursive: true });
          
          let existingScreenConfig: ScreenBaseline | null = null;
          try {
            const existingData = await fs.readFile(screenJsonPath, 'utf-8');
            existingScreenConfig = JSON.parse(existingData);
          } catch {
          }
          
          await fs.copyFile(sourcePath, baselinePath);
          const hash = await computeHash(baselinePath);
          
          const screenMeta = metadata?.screens?.[screenId];
          const name = screenMeta?.name || existingScreenConfig?.name || screenId;
          const url = screenMeta?.url || existingScreenConfig?.url || `/${screenId}`;
          const tags = screenMeta?.tags || existingScreenConfig?.tags;
          
          const screenConfig: ScreenBaseline = {
            name,
            url,
            ...(tags && { tags }),
            ...(screenMeta?.viewport && { viewport: screenMeta.viewport }),
            ...(screenMeta?.thresholds && { thresholds: screenMeta.thresholds }),
            ...(screenMeta?.masks && { masks: screenMeta.masks }),
            ...(existingScreenConfig?.viewport && !screenMeta?.viewport && { viewport: existingScreenConfig.viewport }),
            ...(existingScreenConfig?.thresholds && !screenMeta?.thresholds && { thresholds: existingScreenConfig.thresholds }),
            ...(existingScreenConfig?.masks && !screenMeta?.masks && { masks: existingScreenConfig.masks }),
          };
          
          await fs.writeFile(screenJsonPath, JSON.stringify(screenConfig, null, 2));
          
          const existingIndex = manifest.baselines.findIndex(b => b.screenId === screenId);
          const entry: ManifestEntry = {
            screenId,
            name,
            url,
            hash,
            ...(tags && { tags }),
          };
          
          if (existingIndex >= 0) {
            manifest.baselines[existingIndex] = entry;
            updated++;
          } else {
            manifest.baselines.push(entry);
            added++;
          }
          
          spinner.text = `Imported ${chalk.cyan(screenId)} (${added + updated}/${pngFiles.length})`;
        }
        
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
        
        spinner.succeed(`Imported ${added} new, updated ${updated} existing baselines`);
      } catch (error) {
        spinner.fail('Failed to import baselines');
        console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
        process.exit(1);
      }
    } else {
      const spinner = ora('Loading configuration...').start();

      try {
        const config = await loadConfig();
        const baselineManager = new BaselineManager(
          path.join(process.cwd(), 'baselines')
        );
        const engine = new ScreenshotEngine();

        await engine.initialize();
        spinner.succeed('Configuration loaded');

        const routes = options.route
          ? config.routes.filter((r) => r.path === options.route)
          : config.routes;

        if (routes.length === 0) {
          spinner.fail(`Route ${chalk.cyan(options.route)} not found`);
          console.error(chalk.red('\nError: The specified route does not exist in the configuration.'));
          console.error(chalk.dim('\nAvailable routes:'));
          config.routes.forEach(r => console.error(chalk.dim(`  - ${r.path}`)));
          process.exit(1);
        }

        for (const route of routes) {
          spinner.start(`Capturing ${route.path}...`);

          const tempPath = path.join(
            process.cwd(),
            'runs',
            'temp',
            `${route.name}.png`
          );
          await fs.mkdir(path.dirname(tempPath), { recursive: true });

          await engine.captureRoute(
            config.baseUrl,
            route,
            config.viewport,
            tempPath
          );

          await baselineManager.add(route.path, tempPath, {
            route: route.path,
            timestamp: new Date().toISOString(),
            viewport: config.viewport,
            userAgent: 'AI-Gate/1.0 Deterministic',
          });

          spinner.succeed(`Captured ${chalk.cyan(route.path)}`);
        }

        await engine.close();
        console.log(chalk.green('\n✓ Baselines updated successfully'));
      } catch (error) {
        spinner.fail('Failed to capture baselines');
        console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
        process.exit(1);
      }
    }
  });

baselineCommand
  .command('list')
  .description('List all baseline screenshots with metadata')
  .option('--out <dir>', 'Baseline directory (default: baselines)', 'baselines')
  .addHelpText('after', `
Example:
  $ pnpm gate baseline list`)
  .action(async (options) => {
    try {
      const outDir = path.resolve(process.cwd(), options.out);
      const manifestPath = path.join(outDir, 'manifest.json');
      
      let manifest: Manifest;
      try {
        const manifestData = await fs.readFile(manifestPath, 'utf-8');
        manifest = JSON.parse(manifestData);
      } catch {
        console.log(chalk.yellow('No manifest.json found. Falling back to legacy format...'));
        const baselineManager = new BaselineManager(outDir);
        const baselines = await baselineManager.list();

        if (baselines.length === 0) {
          console.log(chalk.yellow('No baselines found'));
          return;
        }

        console.log(chalk.bold('\nBaselines (legacy):'));
        for (const baseline of baselines) {
          console.log(`  ${chalk.cyan(baseline.route)} - ${baseline.timestamp}`);
        }
        console.log();
        return;
      }

      if (manifest.baselines.length === 0) {
        console.log(chalk.yellow('No baselines found'));
        return;
      }

      console.log(chalk.bold('\nBaselines:'));
      for (const baseline of manifest.baselines) {
        const tags = baseline.tags ? ` [${baseline.tags.join(', ')}]` : '';
        console.log(`  ${chalk.cyan(baseline.screenId)} - ${baseline.url}${tags}`);
        console.log(`    Hash: ${baseline.hash.substring(0, 12)}...`);
      }
      console.log(`\nTotal: ${manifest.baselines.length} baselines`);
    } catch (error) {
      console.error(chalk.red('Failed to list baselines'));
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

baselineCommand
  .command('validate')
  .description('Validate baseline integrity (structure, hashes, configs)')
  .option('--out <dir>', 'Baseline directory (default: baselines)', 'baselines')
  .option('--check-hash', 'Verify PNG file hashes match manifest (slow)')
  .addHelpText('after', `
Examples:
  Quick validation (structure only):
    $ pnpm gate baseline validate

  Full validation (includes hash verification):
    $ pnpm gate baseline validate --check-hash`)
  .action(async (options) => {
    const spinner = ora('Validating baselines...').start();

    try {
      const outDir = path.resolve(process.cwd(), options.out);
      const manifestPath = path.join(outDir, 'manifest.json');
      
      let manifest: Manifest;
      try {
        const manifestData = await fs.readFile(manifestPath, 'utf-8');
        manifest = JSON.parse(manifestData);
      } catch {
        spinner.fail('No manifest.json found');
        process.exit(1);
      }

      const errors: string[] = [];
      const warnings: string[] = [];
      const seenIds = new Set<string>();

      for (const baseline of manifest.baselines) {
        if (seenIds.has(baseline.screenId)) {
          errors.push(`Duplicate screenId: ${baseline.screenId}`);
        }
        seenIds.add(baseline.screenId);

        const screenDir = path.join(outDir, baseline.screenId);
        const baselinePath = path.join(screenDir, 'baseline.png');
        const screenJsonPath = path.join(screenDir, 'screen.json');

        try {
          await fs.access(baselinePath);
        } catch {
          errors.push(`Missing baseline file: ${baseline.screenId}/baseline.png`);
          continue;
        }

        let screenConfig: ScreenBaseline | null = null;
        try {
          const screenData = await fs.readFile(screenJsonPath, 'utf-8');
          screenConfig = JSON.parse(screenData);

          if (screenConfig.viewport) {
            if (screenConfig.viewport.width && screenConfig.viewport.width <= 0) {
              errors.push(`${baseline.screenId}: Invalid viewport width`);
            }
            if (screenConfig.viewport.height && screenConfig.viewport.height <= 0) {
              errors.push(`${baseline.screenId}: Invalid viewport height`);
            }
          }

          if (screenConfig.masks) {
            for (let i = 0; i < screenConfig.masks.length; i++) {
              const mask = screenConfig.masks[i];
              if (mask.type === 'css' && !mask.selector) {
                errors.push(`${baseline.screenId}: Mask ${i} missing selector`);
              }
              if (mask.type === 'rect' && (mask.x === undefined || mask.y === undefined || mask.width === undefined || mask.height === undefined)) {
                errors.push(`${baseline.screenId}: Mask ${i} missing rect coordinates`);
              }
            }
          }
        } catch {
          warnings.push(`${baseline.screenId}: Missing or invalid screen.json`);
        }

        if (options.checkHash) {
          const actualHash = await computeHash(baselinePath);
          if (actualHash !== baseline.hash) {
            errors.push(`${baseline.screenId}: Hash mismatch (expected ${baseline.hash.substring(0, 12)}..., got ${actualHash.substring(0, 12)}...)`);
          }
        }
      }

      if (warnings.length > 0) {
        spinner.warn('Validation completed with warnings');
        console.log(chalk.yellow('\nWarnings:'));
        warnings.forEach(w => console.log(`  - ${w}`));
      }

      if (errors.length > 0) {
        spinner.fail(`Validation failed with ${errors.length} error(s)`);
        console.log(chalk.red('\nErrors:'));
        errors.forEach(e => console.log(`  - ${e}`));
        process.exit(1);
      }

      if (warnings.length === 0) {
        spinner.succeed(`All ${manifest.baselines.length} baselines are valid`);
      }
    } catch (error) {
      spinner.fail('Validation failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

baselineCommand
  .command('update')
  .description('Update existing baselines by re-capturing screenshots')
  .requiredOption('--baseURL <url>', 'Base URL of running application')
  .option('--changedOnly', 'Update only screens that failed in latest run')
  .option('--screens <ids>', 'Comma-separated screen IDs to update (e.g., screen-01,screen-03)')
  .option('--out <dir>', 'Baseline directory (default: baselines)', 'baselines')
  .addHelpText('after', `
Examples:
  Update all baselines:
    $ pnpm gate baseline update --baseURL http://localhost:5173

  Update only failed screens from last run:
    $ pnpm gate baseline update --baseURL http://localhost:5173 --changedOnly

  Update specific screens:
    $ pnpm gate baseline update --baseURL http://localhost:5173 --screens screen-01,screen-05,screen-10`)
  .action(async (options) => {
    const spinner = ora('Initializing baseline update...').start();

    try {
      const baseURL = options.baseURL;
      const changedOnly = options.changedOnly || false;
      const outDir = path.resolve(process.cwd(), options.out);
      const manifestPath = path.join(outDir, 'manifest.json');

      let manifest: Manifest;
      try {
        const manifestData = await fs.readFile(manifestPath, 'utf-8');
        manifest = JSON.parse(manifestData);
      } catch (error) {
        spinner.fail('No baselines/manifest.json found');
        console.error(chalk.red('\nError: Cannot find baselines/manifest.json'));
        console.error(chalk.dim('\nCreate baselines first:'));
        console.error(chalk.dim('  $ pnpm gate baseline add --from /path/to/screenshots'));
        console.error(chalk.dim('  $ pnpm gate baseline add --from /path/to/screenshots --meta screens.json'));
        process.exit(1);
      }

      let targetScreenIds: string[];

      if (options.screens) {
        targetScreenIds = options.screens.split(',').map((s: string) => s.trim());
      } else if (changedOnly) {
        targetScreenIds = await determineChangedScreens(process.cwd());
        if (targetScreenIds.length === 0) {
          spinner.info('No changed screens found, updating all baselines');
          targetScreenIds = manifest.baselines.map(b => b.screenId);
        }
      } else {
        targetScreenIds = manifest.baselines.map(b => b.screenId);
      }

      const targetBaselines = manifest.baselines.filter(b => 
        targetScreenIds.includes(b.screenId)
      );

      if (targetBaselines.length === 0) {
        spinner.fail('No matching screens found to update');
        process.exit(1);
      }

      spinner.succeed(`Found ${targetBaselines.length} screen(s) to update`);

      const engine = new ScreenshotEngine();
      await engine.initialize();

      const updateResults: Array<{
        screenId: string;
        success: boolean;
        oldHash: string;
        newHash?: string;
        error?: string;
      }> = [];

      for (const baseline of targetBaselines) {
        spinner.start(`Updating ${chalk.cyan(baseline.screenId)}...`);

        const screenDir = path.join(outDir, baseline.screenId);
        const screenJsonPath = path.join(screenDir, 'screen.json');
        const baselinePath = path.join(screenDir, 'baseline.png');

        let screenConfig: ScreenBaseline;
        try {
          const screenData = await fs.readFile(screenJsonPath, 'utf-8');
          screenConfig = JSON.parse(screenData);
        } catch {
          spinner.fail(`Cannot read screen.json for ${baseline.screenId}`);
          await engine.close();
          process.exit(1);
        }

        const viewport: ViewportConfig = {
          ...DEFAULT_VIEWPORT,
          ...screenConfig.viewport,
        };

        const tempPath = path.join(outDir, '.temp', `${baseline.screenId}.png`);
        await fs.mkdir(path.dirname(tempPath), { recursive: true });

        const captureResult = await engine.captureScreen(
          baseURL,
          screenConfig,
          viewport,
          tempPath
        );

        if (!captureResult.success) {
          spinner.fail(`Failed to capture ${baseline.screenId}: ${captureResult.error}`);
          updateResults.push({
            screenId: baseline.screenId,
            success: false,
            oldHash: baseline.hash,
            error: captureResult.error,
          });
          await engine.close();
          process.exit(1);
        }

        await fs.copyFile(tempPath, baselinePath);
        const newHash = await computeHash(baselinePath);

        const manifestIndex = manifest.baselines.findIndex(b => b.screenId === baseline.screenId);
        if (manifestIndex >= 0) {
          manifest.baselines[manifestIndex].hash = newHash;
        }

        updateResults.push({
          screenId: baseline.screenId,
          success: true,
          oldHash: baseline.hash,
          newHash,
        });

        spinner.succeed(`Updated ${chalk.cyan(baseline.screenId)} - ${newHash.substring(0, 12)}...`);
      }

      await engine.close();

      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      try {
        await fs.rm(path.join(outDir, '.temp'), { recursive: true, force: true });
      } catch {}

      const summary = {
        timestamp: new Date().toISOString(),
        baseURL,
        totalUpdated: updateResults.filter(r => r.success).length,
        totalFailed: updateResults.filter(r => !r.success).length,
        results: updateResults,
      };

      const summaryPath = path.join(outDir, 'baselines-update-summary.json');
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

      console.log(chalk.green(`\n✓ Updated ${summary.totalUpdated} baseline(s)`));
      console.log(`  Summary: ${chalk.cyan(summaryPath)}`);

      if (summary.totalFailed > 0) {
        console.log(chalk.red(`\n✗ ${summary.totalFailed} baseline(s) failed to update`));
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Baseline update failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

async function determineChangedScreens(cwd: string): Promise<string[]> {
  try {
    const runsDir = path.join(cwd, 'runs');
    const runDirs = await fs.readdir(runsDir);
    
    const runDirsWithTime = await Promise.all(
      runDirs.map(async (dir) => {
        const fullPath = path.join(runsDir, dir);
        const stat = await fs.stat(fullPath);
        return { dir, mtime: stat.mtime.getTime() };
      })
    );

    runDirsWithTime.sort((a, b) => b.mtime - a.mtime);

    for (const { dir } of runDirsWithTime) {
      const summaryPath = path.join(runsDir, dir, 'summary.json');
      try {
        const summaryData = await fs.readFile(summaryPath, 'utf-8');
        const summary = JSON.parse(summaryData) as { results: Array<{ screenId: string; status: string }> };
        
        const changedScreenIds = summary.results
          .filter(r => r.status === 'WARN' || r.status === 'FAIL')
          .map(r => r.screenId);

        if (changedScreenIds.length > 0) {
          return changedScreenIds;
        }
      } catch {
        continue;
      }
    }

    return [];
  } catch {
    return [];
  }
}
