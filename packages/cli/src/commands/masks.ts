import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';
import {
  suggestMasksForScreen,
  prepareDeterministicPage,
  DETERMINISTIC_DEFAULTS,
  convertToMask,
  isSafeToMask,
  type MaskSuggestionWithMetadata,
  type ScreenBaseline,
} from '@ai-gate/core';
import { loadConfig } from '../config.js';

export const masksCommand = new Command('masks').description(
  'Analyze and suggest element masks'
);

masksCommand
  .command('suggest')
  .description('Suggest masks for dynamic elements')
  .requiredOption('--baseURL <url>', 'Base URL of the application')
  .option('--screen <id>', 'Specific screen ID to analyze')
  .option('--apply', 'Apply high-confidence suggestions to baseline files')
  .option('--maxSuggestions <number>', 'Maximum suggestions per screen', '8')
  .option('--reload', 'Reload page between snapshots')
  .action(async (options) => {
    try {
      const config = await loadConfig();
      const baseURL = options.baseURL;
      const maxSuggestions = parseInt(options.maxSuggestions, 10);
      const applyMode = options.apply || false;
      const reloadMode = options.reload || false;

      const baselinesDir = path.join(process.cwd(), 'baselines');
      const runId = `suggest-${Date.now()}`;
      const runDir = path.join(process.cwd(), 'runs', runId);

      await fs.mkdir(runDir, { recursive: true });

      let screenIds: string[] = [];
      if (options.screen) {
        screenIds = [options.screen];
      } else {
        const entries = await fs.readdir(baselinesDir, { withFileTypes: true });
        screenIds = entries
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
          .filter((name) => name.startsWith('screen-'));
      }

      console.log(chalk.bold('\n🎭 Mask Suggestion Mode\n'));
      console.log(`Base URL: ${chalk.cyan(baseURL)}`);
      console.log(`Screens: ${screenIds.length}`);
      console.log(`Max suggestions per screen: ${maxSuggestions}`);
      console.log(`Apply mode: ${applyMode ? chalk.green('ON') : chalk.dim('OFF')}`);
      console.log(`Reload mode: ${reloadMode ? chalk.green('ON') : chalk.dim('OFF')}\n`);

      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: DETERMINISTIC_DEFAULTS.deviceScaleFactor,
        locale: DETERMINISTIC_DEFAULTS.locale,
        timezoneId: DETERMINISTIC_DEFAULTS.timezoneId,
        colorScheme: DETERMINISTIC_DEFAULTS.colorScheme,
        reducedMotion: DETERMINISTIC_DEFAULTS.reduceMotion,
      });

      const allSuggestions: MaskSuggestionWithMetadata[] = [];

      for (const screenId of screenIds) {
        const screenPath = path.join(baselinesDir, screenId, 'screen.json');

        let screenConfig: ScreenBaseline;
        try {
          const screenData = await fs.readFile(screenPath, 'utf-8');
          screenConfig = JSON.parse(screenData);
        } catch (error) {
          console.log(
            chalk.yellow(`⚠ Skipping ${screenId}: screen.json not found`)
          );
          continue;
        }

        const url = new URL(screenConfig.url, baseURL).toString();

        console.log(chalk.cyan(`\n${screenId}: ${screenConfig.name}`));
        console.log(`  URL: ${url}`);

        const page = await context.newPage();

        try {
          await prepareDeterministicPage(page, {
            ...DETERMINISTIC_DEFAULTS,
            layoutStabilityMs: 300,
          });

          await page.goto(url, { waitUntil: 'networkidle' });

          const suggestions = await suggestMasksForScreen(page, screenId, {
            maxSuggestions,
            reload: reloadMode,
            layoutStabilityMs: 300,
          });

          if (suggestions.length === 0) {
            console.log(chalk.green('  ✓ No volatile elements detected'));
          } else {
            console.log(
              chalk.yellow(`  📋 ${suggestions.length} suggestion(s):`)
            );
            for (const s of suggestions) {
              const confidencePercent = (s.confidence * 100).toFixed(0);
              const badge =
                s.confidence >= 0.75 ? chalk.green('●') : chalk.dim('○');
              console.log(
                `    ${badge} ${s.selector} (${confidencePercent}% confidence)`
              );
              console.log(`       ${chalk.dim(s.reason)}`);
            }
          }

          for (const s of suggestions) {
            allSuggestions.push({ ...s, screenId, route: screenConfig.url });
          }

          if (applyMode) {
            const highConfidence = suggestions.filter(
              (s) => s.confidence >= 0.75 && isSafeToMask({ 
                selector: s.selector,
                text: s.examples.join(' '),
                bbox: s.bbox || { x: 0, y: 0, width: 0, height: 0 },
                visible: true,
              })
            );

            if (highConfidence.length > 0) {
              const existingMasks = screenConfig.masks || [];
              const newMasks = highConfidence.map((s) => convertToMask(s));

              screenConfig.masks = [...existingMasks, ...newMasks];

              await fs.writeFile(
                screenPath,
                JSON.stringify(screenConfig, null, 2)
              );

              console.log(
                chalk.green(
                  `  ✓ Applied ${highConfidence.length} high-confidence mask(s)`
                )
              );
            }
          }
        } catch (error) {
          console.log(
            chalk.red(
              `  ✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          );
        } finally {
          await page.close();
        }
      }

      await browser.close();

      const outputPath = path.join(runDir, 'mask-suggestions.json');
      await fs.writeFile(
        outputPath,
        JSON.stringify(
          {
            runId,
            timestamp: new Date().toISOString(),
            baseURL,
            totalScreens: screenIds.length,
            totalSuggestions: allSuggestions.length,
            suggestions: allSuggestions,
          },
          null,
          2
        )
      );

      console.log(chalk.bold('\n📊 Summary:\n'));
      console.log(`Total screens analyzed: ${screenIds.length}`);
      console.log(`Total suggestions: ${allSuggestions.length}`);
      console.log(
        `High confidence (≥75%): ${allSuggestions.filter((s) => s.confidence >= 0.75).length}`
      );
      console.log(`Output: ${chalk.dim(outputPath)}\n`);

      if (applyMode) {
        console.log(
          chalk.green(
            '✓ High-confidence masks have been applied to baseline files'
          )
        );
      } else {
        console.log(
          chalk.dim(
            'Run with --apply to automatically add high-confidence masks to baselines'
          )
        );
      }
    } catch (error) {
      console.error(chalk.red('\n✗ Failed to suggest masks'));
      console.error(
        chalk.red(error instanceof Error ? error.message : 'Unknown error')
      );
      process.exit(1);
    }
  });
