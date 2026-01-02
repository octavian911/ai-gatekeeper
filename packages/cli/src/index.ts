#!/usr/bin/env node
import { Command } from 'commander';
import { baselineCommand } from './commands/baseline.js';
import { gateCommand } from './commands/gate.js';
import { masksCommand } from './commands/masks.js';

const program = new Command();

program
  .name('ai-gate')
  .description('AI Output Gate - Visual regression testing for CI/CD')
  .version('1.0.0')
  .option('--verbose', 'Enable verbose logging')
  .option('--quiet', 'Suppress non-error output');

program.addCommand(baselineCommand);
program.addCommand(gateCommand);
program.addCommand(masksCommand);

program.parse();
