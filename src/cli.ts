#!/usr/bin/env node
/**
 * ddna-reader - Read-only CLI for .ddna envelopes
 *
 * Commands:
 *   inspect - Inspect a .ddna envelope structure and contents
 *   validate - Validate envelope structure against schema
 *
 * This tool does NOT:
 *   - Verify cryptographic signatures
 *   - Seal or sign envelopes
 *   - Generate keys
 *
 * For sealing and signature verification, use the DeepaData API at deepadata.com
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspect, inspectJson, validateStructure } from './lib/inspect.js';

// Get package version
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let version = '0.1.0';
try {
  const pkgPath = path.resolve(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  version = pkg.version;
} catch {
  // Use default version
}

const program = new Command();

program
  .name('ddna-reader')
  .description('Read-only tools for .ddna envelope inspection and validation')
  .version(version);

/**
 * Read file and parse as JSON
 */
function readJsonFile(filePath: string): object {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : error}`);
  }
}

// ============================================================================
// INSPECT COMMAND
// ============================================================================

program
  .command('inspect')
  .description('Inspect a .ddna envelope and display its contents')
  .argument('<input>', 'Path to .ddna envelope')
  .option('--json', 'Output as JSON')
  .action((input: string, options) => {
    try {
      // Read envelope
      const envelope = readJsonFile(input);

      if (options.json) {
        // JSON output
        const result = inspectJson(envelope);
        console.log(JSON.stringify(result, null, 2));
      } else {
        // Human-readable output
        const output = inspect(envelope);
        console.log(output);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================================
// VALIDATE COMMAND
// ============================================================================

program
  .command('validate')
  .description('Validate .ddna envelope structure (schema validation only, not signature)')
  .argument('<input>', 'Path to .ddna envelope')
  .option('--strict', 'Treat warnings as errors')
  .action((input: string, options) => {
    try {
      // Read envelope
      const envelope = readJsonFile(input);

      // Validate structure
      const result = validateStructure(envelope);

      if (result.valid && (!options.strict || result.warnings.length === 0)) {
        console.log(chalk.green('VALID') + ' - Envelope structure is valid');

        if (result.warnings.length > 0) {
          console.log('');
          console.log(chalk.yellow('Warnings:'));
          result.warnings.forEach((w) => console.log(`  - ${w}`));
        }

        console.log('');
        console.log(chalk.dim('Note: This validates structure only, not cryptographic signature.'));
        console.log(chalk.dim('For signature verification, use the DeepaData API at deepadata.com'));
      } else {
        console.log(chalk.red('INVALID') + ' - Envelope structure has errors');

        if (result.errors.length > 0) {
          console.log('');
          console.log(chalk.red('Errors:'));
          result.errors.forEach((e) => console.log(`  - ${e}`));
        }

        if (result.warnings.length > 0) {
          console.log('');
          console.log(chalk.yellow('Warnings:'));
          result.warnings.forEach((w) => console.log(`  - ${w}`));
        }

        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================================
// HELP TEXT
// ============================================================================

program.addHelpText('after', `
${chalk.bold('About this tool:')}
  This is a read-only tool for inspecting .ddna envelope contents.
  It validates structure but does NOT verify cryptographic signatures.

${chalk.bold('For sealing and verification:')}
  Use the DeepaData API at ${chalk.cyan('https://deepadata.com')}

${chalk.bold('Examples:')}
  $ ddna-reader inspect envelope.ddna
  $ ddna-reader inspect envelope.ddna --json
  $ ddna-reader validate envelope.ddna
  $ ddna-reader validate envelope.ddna --strict
`);

// ============================================================================
// PARSE AND EXECUTE
// ============================================================================

program.parse();
