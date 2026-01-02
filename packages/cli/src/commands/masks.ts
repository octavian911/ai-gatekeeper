import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { suggestMasks, type GateResult } from '@ai-gate/core';

export const masksCommand = new Command('masks')
  .description('Analyze and suggest element masks');

masksCommand
  .command('suggest')
  .description('Suggest masks for dynamic elements')
  .option('-r, --run <runId>', 'Analyze specific run (default: latest)')
  .action(async (options) => {
    try {
      const runId = options.run || 'latest';
      const summaryPath = path.join(
        process.cwd(),
        'runs',
        runId,
        'summary.json'
      );

      const summaryData = await fs.readFile(summaryPath, 'utf-8');
      const result: GateResult = JSON.parse(summaryData);

      const suggestions = suggestMasks(result.comparisons);

      if (suggestions.length === 0) {
        console.log(chalk.green('✓ No mask suggestions needed'));
        return;
      }

      console.log(chalk.bold('\n🎭 Mask Suggestions:\n'));

      for (const suggestion of suggestions) {
        console.log(chalk.cyan(`${suggestion.route}`));
        console.log(`  Selector: ${chalk.yellow(suggestion.selector)}`);
        console.log(`  Reason: ${suggestion.reason}`);
        console.log(
          `  Confidence: ${(suggestion.confidence * 100).toFixed(0)}%\n`
        );
      }

      console.log(
        chalk.dim('Add these selectors to your route config with data-gate-mask attribute')
      );
    } catch (error) {
      console.error(chalk.red('Failed to suggest masks'));
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });
