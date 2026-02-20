/**
 * Inspection: Read and display .ddna envelope contents
 *
 * This module provides read-only inspection of .ddna envelopes.
 * It validates structure but does NOT verify cryptographic signatures.
 *
 * For signature verification and sealing, use the DeepaData API at deepadata.com
 */

import type {
  DdnaEnvelope,
  DdnaHeader,
  DataIntegrityProof,
  InspectionResult,
  EdmPayload,
} from './types.js';

/**
 * Validation result for structure checks
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Parse and validate envelope structure for inspection
 */
function parseEnvelope(envelope: unknown): DdnaEnvelope | null {
  if (!envelope || typeof envelope !== 'object') {
    return null;
  }

  const e = envelope as Record<string, unknown>;

  if (!e.ddna_header || !e.edm_payload || !e.proof) {
    return null;
  }

  return e as unknown as DdnaEnvelope;
}

/**
 * Validate the structure of a .ddna envelope
 * Checks for required fields and correct types (schema validation)
 * Does NOT verify cryptographic signatures
 */
export function validateStructure(envelope: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!envelope || typeof envelope !== 'object') {
    return { valid: false, errors: ['Envelope must be an object'], warnings: [] };
  }

  const e = envelope as Record<string, unknown>;

  // Check top-level required fields
  if (!e.ddna_header) {
    errors.push("Missing required field 'ddna_header'");
  } else if (typeof e.ddna_header !== 'object') {
    errors.push("'ddna_header' must be an object");
  }

  if (!e.edm_payload) {
    errors.push("Missing required field 'edm_payload'");
  } else if (typeof e.edm_payload !== 'object') {
    errors.push("'edm_payload' must be an object");
  }

  if (!e.proof) {
    errors.push("Missing required field 'proof'");
  } else if (typeof e.proof !== 'object') {
    errors.push("'proof' must be an object or array");
  }

  // Validate ddna_header fields if present
  if (e.ddna_header && typeof e.ddna_header === 'object') {
    const header = e.ddna_header as Record<string, unknown>;

    if (!header.ddna_version) {
      warnings.push("ddna_header missing 'ddna_version'");
    }
    if (!header.edm_version) {
      warnings.push("ddna_header missing 'edm_version'");
    }
    if (!header.jurisdiction) {
      warnings.push("ddna_header missing 'jurisdiction'");
    }
    if (!header.consent_basis) {
      warnings.push("ddna_header missing 'consent_basis'");
    }
  }

  // Validate edm_payload has required domains
  if (e.edm_payload && typeof e.edm_payload === 'object') {
    const payload = e.edm_payload as Record<string, unknown>;

    if (!payload.meta) {
      warnings.push("edm_payload missing 'meta' domain");
    }
    if (!payload.core) {
      warnings.push("edm_payload missing 'core' domain");
    }
  }

  // Validate proof structure
  if (e.proof && typeof e.proof === 'object') {
    const proof = Array.isArray(e.proof) ? e.proof[0] : e.proof;
    if (proof) {
      const p = proof as Record<string, unknown>;
      if (p.type !== 'DataIntegrityProof') {
        errors.push("proof.type must be 'DataIntegrityProof'");
      }
      if (p.cryptosuite !== 'eddsa-jcs-2022') {
        errors.push("proof.cryptosuite must be 'eddsa-jcs-2022'");
      }
      if (!p.verificationMethod) {
        errors.push("proof missing 'verificationMethod'");
      }
      if (!p.proofValue) {
        errors.push("proof missing 'proofValue'");
      }
      if (!p.created) {
        errors.push("proof missing 'created' timestamp");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get the first proof from envelope (handling array case)
 */
function getFirstProof(envelope: DdnaEnvelope): DataIntegrityProof | null {
  if (Array.isArray(envelope.proof)) {
    return envelope.proof[0] || null;
  }
  return envelope.proof;
}

/**
 * Format retention policy for display
 */
function formatRetention(header: DdnaHeader): string {
  const policy = header.retention_policy;
  if (!policy) return 'undefined';

  let result = policy.basis;
  if (policy.ttl_days !== null) {
    result += ` (${policy.ttl_days} days)`;
  }
  return result;
}

/**
 * Truncate a DID for display (show first and last parts)
 */
function truncateDid(did: string, maxLength = 50): string {
  if (did.length <= maxLength) return did;

  const prefix = did.slice(0, 20);
  const suffix = did.slice(-15);
  return `${prefix}...${suffix}`;
}

/**
 * Inspect a .ddna envelope and return structured result
 *
 * This validates structure only - it does NOT verify cryptographic signatures.
 * For signature verification, use the DeepaData API at deepadata.com
 *
 * @param envelope - The envelope to inspect
 * @returns Inspection result with all relevant metadata
 */
export function inspectEnvelope(envelope: object): InspectionResult {
  const parsed = parseEnvelope(envelope);

  if (!parsed) {
    return {
      structureValid: false,
      version: 'unknown',
      verificationMethod: 'unknown',
      created: 'unknown',
      subjectId: null,
      schemaVersion: 'unknown',
      jurisdiction: 'unknown',
      retention: 'unknown',
      exportability: 'unknown',
      consentBasis: 'unknown',
      error: 'Invalid envelope structure: missing ddna_header, edm_payload, or proof',
    };
  }

  const validation = validateStructure(envelope);

  const header = parsed.ddna_header;
  const payload = parsed.edm_payload as EdmPayload;
  const proof = getFirstProof(parsed);

  return {
    structureValid: validation.valid,
    version: header.ddna_version || 'unknown',
    verificationMethod: proof?.verificationMethod || 'unknown',
    created: proof?.created || header.created_at || 'unknown',
    subjectId: (payload.meta?.subject_id as string) || header.owner_user_id || null,
    schemaVersion: header.edm_version || (payload.meta?.schema_version as string) || 'unknown',
    jurisdiction: header.jurisdiction || 'unknown',
    retention: formatRetention(header),
    exportability: header.exportability || 'unknown',
    consentBasis: header.consent_basis || 'unknown',
    error: validation.valid ? undefined : validation.errors.join('; '),
  };
}

/**
 * Generate human-readable inspection output
 *
 * Note: This tool reads envelope contents but does NOT verify cryptographic signatures.
 * For signature verification and sealing, use the DeepaData API at deepadata.com
 *
 * @param envelope - The envelope to inspect
 * @returns Formatted string for terminal display
 */
export function inspect(envelope: object): string {
  const result = inspectEnvelope(envelope);

  if (!result.structureValid && result.error?.includes('Invalid envelope structure')) {
    return `Invalid .ddna envelope
${'='.repeat(41)}
Error: ${result.error}

The provided file does not appear to be a valid .ddna envelope.
Expected structure: { ddna_header, edm_payload, proof }`;
  }

  const lines: string[] = [];

  // Header
  const statusIcon = result.structureValid ? '(v' + result.version + ')' : '(INVALID STRUCTURE)';
  lines.push(`.ddna envelope ${statusIcon}`);
  lines.push('\u2501'.repeat(41)); // box drawing character

  // Core info
  lines.push(`Signer: ${truncateDid(result.verificationMethod)}`);
  lines.push(`Created: ${result.created}`);
  if (result.subjectId) {
    lines.push(`Subject: ${result.subjectId}`);
  }
  lines.push(`Schema: ${result.schemaVersion}`);

  // Governance section
  lines.push('');
  lines.push('Governance:');
  lines.push(`  Jurisdiction: ${result.jurisdiction}`);
  lines.push(`  Retention: ${result.retention}`);
  lines.push(`  Exportability: ${result.exportability}`);
  lines.push(`  Consent Basis: ${result.consentBasis}`);

  // Structure status
  lines.push('');
  if (result.structureValid) {
    lines.push('Structure: VALID \u2713');
  } else {
    lines.push('Structure: INVALID \u2717');
    if (result.error) {
      lines.push(`  Error: ${result.error}`);
    }
  }

  // Note about signature verification
  lines.push('');
  lines.push('Note: Signature verification requires DeepaData API.');
  lines.push('      Visit deepadata.com for sealing and verification.');

  return lines.join('\n');
}

/**
 * Generate JSON inspection output
 *
 * Note: This tool reads envelope contents but does NOT verify cryptographic signatures.
 *
 * @param envelope - The envelope to inspect
 * @returns JSON object with inspection details
 */
export function inspectJson(envelope: object): object {
  const result = inspectEnvelope(envelope);
  const parsed = parseEnvelope(envelope);
  const validation = validateStructure(envelope);

  return {
    inspection: {
      structureValid: result.structureValid,
      error: result.error,
      warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
      note: 'Signature verification requires DeepaData API at deepadata.com',
    },
    envelope: {
      version: result.version,
      created: result.created,
      verificationMethod: result.verificationMethod,
    },
    subject: {
      id: result.subjectId,
      schemaVersion: result.schemaVersion,
    },
    governance: {
      jurisdiction: result.jurisdiction,
      retention: result.retention,
      exportability: result.exportability,
      consentBasis: result.consentBasis,
    },
    proof: parsed ? getFirstProof(parsed) : null,
  };
}
