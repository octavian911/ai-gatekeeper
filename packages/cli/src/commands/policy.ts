import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { validatePolicy, loadOrgPolicy, mergeDefaults, mergeEnforcement, computePolicyHash } from '@ai-gate/core';

export const policyCommand = new Command('policy')
  .description('Manage org-wide policy configuration');

policyCommand
  .command('validate')
  .description('Validate .gate/policy.json and show resolved configuration')
  .action(async () => {
    const spinner = ora('Validating policy...').start();
    
    try {
      const result = await validatePolicy();
      
      if (!result.valid) {
        spinner.fail('Policy validation failed');
        console.error(chalk.red('\nErrors:'));
        result.errors.forEach((err) => {
          console.error(chalk.red(`  ✗ ${err}`));
        });
        process.exit(1);
      }
      
      if (result.warnings.length > 0) {
        spinner.warn('Policy validation passed with warnings');
        console.log(chalk.yellow('\nWarnings:'));
        result.warnings.forEach((warn) => {
          console.log(chalk.yellow(`  ⚠ ${warn}`));
        });
      } else {
        spinner.succeed('Policy validation passed');
      }
      
      if (result.policy) {
        const defaults = mergeDefaults(result.policy);
        const enforcement = mergeEnforcement(result.policy);
        const policyHash = computePolicyHash(result.policy);
        
        console.log(chalk.bold('\n📋 Resolved Policy Summary:\n'));
        console.log(chalk.cyan('Policy Hash:'), policyHash);
        console.log(chalk.cyan('\nViewport Defaults:'));
        console.log(`  ${defaults.viewport.width}x${defaults.viewport.height}`);
        
        console.log(chalk.cyan('\nDeterminism:'));
        console.log(`  Browser: ${defaults.determinism.browser}`);
        console.log(`  Locale: ${defaults.determinism.locale}`);
        console.log(`  Timezone: ${defaults.determinism.timezoneId}`);
        console.log(`  Disable Animations: ${defaults.determinism.disableAnimations}`);
        console.log(`  Block External Network: ${defaults.determinism.blockExternalNetwork}`);
        console.log(`  Wait Until: ${defaults.determinism.waitUntil}`);
        console.log(`  Layout Stability: ${defaults.determinism.layoutStabilityMs}ms`);
        
        console.log(chalk.cyan('\nThreshold Tiers:'));
        console.log(chalk.green('  Standard:'));
        console.log(`    WARN: ratio ${(defaults.thresholds.standard.warn.diffPixelRatio * 100).toFixed(4)}% | ${defaults.thresholds.standard.warn.diffPixels}px`);
        console.log(`    FAIL: ratio ${(defaults.thresholds.standard.fail.diffPixelRatio * 100).toFixed(4)}% | ${defaults.thresholds.standard.fail.diffPixels}px`);
        
        console.log(chalk.yellow('  Critical:'));
        console.log(`    WARN: ratio ${(defaults.thresholds.critical.warn.diffPixelRatio * 100).toFixed(4)}% | ${defaults.thresholds.critical.warn.diffPixels}px`);
        console.log(`    FAIL: ratio ${(defaults.thresholds.critical.fail.diffPixelRatio * 100).toFixed(4)}% | ${defaults.thresholds.critical.fail.diffPixels}px`);
        
        console.log(chalk.magenta('  Noisy:'));
        console.log(`    WARN: ratio ${(defaults.thresholds.noisy.warn.diffPixelRatio * 100).toFixed(4)}% | ${defaults.thresholds.noisy.warn.diffPixels}px`);
        console.log(`    FAIL: ratio ${(defaults.thresholds.noisy.fail.diffPixelRatio * 100).toFixed(4)}% | ${defaults.thresholds.noisy.fail.diffPixels}px`);
        console.log(`    Require Masks: ${defaults.thresholds.noisy.requireMasks ?? false}`);
        
        if (result.policy.tagRules) {
          console.log(chalk.cyan('\nTag Rules (auto-applied):'));
          if (result.policy.tagRules.criticalRoutes) {
            console.log(chalk.yellow('  Critical routes:'));
            result.policy.tagRules.criticalRoutes.forEach((r) => {
              console.log(`    - ${r}`);
            });
          }
          if (result.policy.tagRules.noisyRoutes) {
            console.log(chalk.magenta('  Noisy routes:'));
            result.policy.tagRules.noisyRoutes.forEach((r) => {
              console.log(`    - ${r}`);
            });
          }
        }
        
        console.log(chalk.cyan('\nEnforcement:'));
        console.log(`  Allow Loosening: ${enforcement.allowLoosening ? chalk.yellow('YES') : chalk.green('NO')}`);
        console.log(`  Allow Per-Screen Viewport Override: ${enforcement.allowPerScreenViewportOverride ? 'YES' : 'NO'}`);
        console.log(`  Allow Per-Screen Mask Override: ${enforcement.allowPerScreenMaskOverride ? 'YES' : 'NO'}`);
        console.log(`  Max Mask Coverage Ratio: ${(enforcement.maxMaskCoverageRatio * 100).toFixed(1)}%`);
        
        if (!enforcement.allowLoosening) {
          console.log(chalk.green('\n✓ Strict enforcement enabled: per-screen overrides cannot loosen thresholds'));
        } else {
          console.log(chalk.yellow('\n⚠ Loosening allowed: screens may relax thresholds with justification'));
        }
      } else {
        console.log(chalk.dim('\nNo .gate/policy.json found. Using core defaults.'));
        console.log(chalk.dim('To create a policy file, see documentation or examples.'));
      }
      
      process.exit(0);
    } catch (error) {
      spinner.fail('Policy validation failed');
      console.error(
        chalk.red(error instanceof Error ? error.message : 'Unknown error')
      );
      process.exit(1);
    }
  });
