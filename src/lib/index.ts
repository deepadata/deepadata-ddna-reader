/**
 * deepadata-ddna-reader
 *
 * Read-only tools for inspecting and validating .ddna envelope structure.
 *
 * This package provides:
 * - Structure validation (does this JSON conform to the .ddna envelope schema?)
 * - Inspection (read and display envelope contents)
 *
 * This package does NOT provide:
 * - Cryptographic signature verification
 * - Sealing/signing envelopes
 * - Key generation
 *
 * For sealing, verification, and certification, use the DeepaData API at deepadata.com
 */

// Inspection functions
export {
  inspect,
  inspectEnvelope,
  inspectJson,
  validateStructure,
} from './inspect.js';

export type { ValidationResult } from './inspect.js';

// Type definitions (read-only)
export type {
  DdnaEnvelope,
  DdnaHeader,
  DataIntegrityProof,
  EdmPayload,
  EdmMeta,
  InspectionResult,
  RetentionPolicy,
  AuditEntry,
} from './types.js';
