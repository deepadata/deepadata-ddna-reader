/**
 * Type definitions for .ddna envelope structure
 * Read-only types for inspection and validation
 */

/**
 * Retention policy for EDM artifacts
 * Aligned with EDM v0.5.0 canonical schema
 */
export interface RetentionPolicy {
  basis: 'user_defined' | 'legal' | 'business_need';
  ttl_days: number | null;
  on_expiry: 'soft_delete' | 'hard_delete' | 'anonymize';
}

/**
 * Audit chain entry for lifecycle tracking
 */
export interface AuditEntry {
  timestamp: string;
  event: string;
  agent: string;
  details?: Record<string, unknown>;
}

/**
 * DDNA header containing governance and lifecycle metadata
 */
export interface DdnaHeader {
  ddna_version: string;
  created_at: string;
  edm_version: string;
  owner_user_id: string | null;
  exportability: 'allowed' | 'restricted' | 'prohibited';
  jurisdiction: string;
  payload_type: string;
  consent_basis: string;
  retention_policy: RetentionPolicy;
  masking_rules?: string[];
  audit_chain?: AuditEntry[];
}

/**
 * W3C Data Integrity Proof structure (read-only)
 */
export interface DataIntegrityProof {
  type: 'DataIntegrityProof';
  cryptosuite: 'eddsa-jcs-2022';
  created: string;
  verificationMethod: string;
  proofPurpose: 'assertionMethod';
  proofValue: string;
  expires?: string;
  domain?: string;
  challenge?: string;
  nonce?: string;
  previousProof?: string;
}

/**
 * EDM payload meta domain
 * Aligned with EDM v0.5.0 canonical schema
 */
export interface EdmMeta {
  /** Artifact owner identifier */
  owner_user_id?: string | null;
  /** EDM schema version (e.g., "0.5.0") */
  version?: string;
  /** ISO 8601 creation timestamp */
  created_at?: string;
  /** Legal basis for processing */
  consent_basis?: string;
  /** Legacy field names (backward compatibility) */
  subject_id?: string;
  schema_version?: string;
  consent_timestamp?: string;
  [key: string]: unknown;
}

/**
 * EDM payload structure
 */
export interface EdmPayload {
  meta?: EdmMeta;
  core?: Record<string, unknown>;
  constellation?: Record<string, unknown>;
  milky_way?: Record<string, unknown>;
  gravity?: Record<string, unknown>;
  impulse?: Record<string, unknown>;
  governance?: Record<string, unknown>;
  telemetry?: Record<string, unknown>;
  system?: Record<string, unknown>;
  crosswalks?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Complete .ddna envelope structure
 */
export interface DdnaEnvelope {
  ddna_header: DdnaHeader;
  edm_payload: EdmPayload;
  proof: DataIntegrityProof | DataIntegrityProof[];
}

/**
 * Inspection result for human-readable output
 */
export interface InspectionResult {
  /** Whether the envelope has valid structure */
  structureValid: boolean;
  /** DDNA envelope version */
  version: string;
  /** DID of the signer (read from proof, not verified) */
  verificationMethod: string;
  /** Timestamp when signed */
  created: string;
  /** Subject/owner identifier */
  subjectId: string | null;
  /** EDM schema version */
  schemaVersion: string;
  /** Governance jurisdiction */
  jurisdiction: string;
  /** Retention policy summary */
  retention: string;
  /** Exportability setting */
  exportability: string;
  /** Consent basis */
  consentBasis: string;
  /** Error message if structure is invalid */
  error?: string;
}
