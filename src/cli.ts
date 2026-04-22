#!/usr/bin/env node
/**
 * ddna-reader - Read-only CLI for .ddna envelopes
 *
 * Commands:
 *   inspect - Inspect a .ddna envelope structure and contents
 *   validate - Validate envelope structure against schema
 *   verify - Verify cryptographic signature (Ed25519)
 *
 * This tool does NOT:
 *   - Seal or sign envelopes (use ddna-tools)
 *   - Generate keys (use ddna-tools)
 *   - Perform registry lookups (use DeepaData API)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspect, inspectJson, validateStructure } from './lib/inspect.js';
import { verify } from './lib/verify.js';

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
        console.log(chalk.dim('For signature verification, use ddna-tools.'));
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
// VERIFY COMMAND
// ============================================================================

/**
 * CLI verify result structure for --json output
 */
interface CliVerifyResult {
  verified: boolean;
  signer_did: string | null;
  created: string | null;
  errors: string[];
}

program
  .command('verify')
  .description('Verify cryptographic signature on a .ddna envelope')
  .argument('<input>', 'Path to .ddna envelope')
  .option('--json', 'Output as JSON')
  .option('--skip-timestamp', 'Skip timestamp validation (created/expires)')
  .option('--clock-skew <ms>', 'Clock skew tolerance in milliseconds (default: 300000)', '300000')
  .action(async (input: string, options) => {
    try {
      // Read envelope
      const envelope = readJsonFile(input);

      // Run verification
      const result = await verify(envelope, {
        skipTimestampCheck: options.skipTimestamp,
        clockSkewMs: parseInt(options.clockSkew, 10),
      });

      // Build CLI result
      const cliResult: CliVerifyResult = {
        verified: result.valid,
        signer_did: result.verificationMethod ?? null,
        created: result.created ?? null,
        errors: result.valid ? [] : [result.reason ?? 'Unknown error'],
      };

      if (options.json) {
        // JSON output
        console.log(JSON.stringify(cliResult, null, 2));
        process.exit(result.valid ? 0 : 1);
      } else {
        // Human-readable output
        if (result.valid) {
          console.log(chalk.green('VERIFIED') + ' - Signature is valid');
          console.log('');
          console.log('Signer:  ' + chalk.cyan(result.verificationMethod));
          console.log('Created: ' + result.created);
          console.log('');
          console.log(chalk.dim('Note: This verifies the cryptographic signature only.'));
          console.log(chalk.dim('For registry lookup (Certified status), use the DeepaData API.'));
          console.log(chalk.dim('Timestamp is signer-attested per W3C Data Integrity, not RFC 3161.'));
        } else {
          console.log(chalk.red('FAILED') + ' - Signature verification failed');
          console.log('');
          console.log(chalk.red('Error:'), result.reason);
          if (result.verificationMethod) {
            console.log('Signer:  ' + result.verificationMethod);
          }
          if (result.created) {
            console.log('Created: ' + result.created);
          }
        }
        process.exit(result.valid ? 0 : 1);
      }
    } catch (error) {
      if (options.json) {
        const cliResult: CliVerifyResult = {
          verified: false,
          signer_did: null,
          created: null,
          errors: [error instanceof Error ? error.message : String(error)],
        };
        console.log(JSON.stringify(cliResult, null, 2));
      } else {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      }
      process.exit(1);
    }
  });

// ============================================================================
// HELP TEXT
// ============================================================================

program.addHelpText('after', `
${chalk.bold('About this tool:')}
  Read-only tool for inspecting and verifying .ddna envelopes.
  - inspect: Display envelope contents
  - validate: Check envelope structure (schema validation)
  - verify: Verify cryptographic signature (Ed25519)

${chalk.bold('Verification notes:')}
  - did:key signatures verify offline (default)
  - did:web signatures require the DeepaData API or custom resolver
  - Timestamps are signer-attested (W3C Data Integrity), not RFC 3161

${chalk.bold('For sealing:')}
  Use ddna-tools: ${chalk.cyan('https://github.com/emotional-data-model/ddna-tools')}

${chalk.bold('Examples:')}
  $ ddna-reader inspect envelope.ddna
  $ ddna-reader inspect envelope.ddna --json
  $ ddna-reader validate envelope.ddna
  $ ddna-reader validate envelope.ddna --strict
  $ ddna-reader verify envelope.ddna
  $ ddna-reader verify envelope.ddna --json
`);

// ============================================================================
// PARSE AND EXECUTE
// ============================================================================

program.parse();
