/**
 * Conformance test suite against canonical EDM test vectors
 *
 * Test vectors source: the published `edm-spec` package (test-vectors/).
 * Resolved at runtime from node_modules — no local copy is maintained, so
 * these tests always run against the spec version pinned in package.json.
 *
 * Per ADR-0020 and edm-spec's docs/CONFORMANCE.md:
 * - These vectors are the canonical source of truth for verification correctness
 * - Any conforming reader must produce the documented expected results
 *
 * Reason category vocabulary (from edm-spec test-vectors/README.md):
 * - VALID: Signature verified successfully
 * - INVALID_SIGNATURE: Ed25519 signature verification failed
 * - MISSING_PROOF: Envelope has no proof block
 * - MALFORMED_PROOF_VALUE: proofValue is not valid base58btc
 * - INVALID_PROOF_STRUCTURE: Required proof field missing or invalid
 * - DID_RESOLUTION_FAILED: Could not resolve verificationMethod
 * - DID_WEB_NO_RESOLVER: did:web without injected resolver
 * - PROOF_EXPIRED: proof.expires is in the past
 * - PROOF_FUTURE: proof.created is in the future
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { createRequire } from 'module';
import { verify } from '../src/lib/verify.js';

// Resolve the test-vectors directory from the published edm-spec package.
// edm-spec exports "./package.json", so we locate the package root and join
// its test-vectors/ directory. This keeps the vectors in lockstep with the
// pinned spec version instead of maintaining a manual local copy.
const require = createRequire(import.meta.url);
const VECTORS_DIR = join(dirname(require.resolve('edm-spec/package.json')), 'test-vectors');

// Load INDEX.json (per edm-spec test-vectors/INDEX.json structure)
interface VectorIndex {
  version: string;
  spec_version: string;
  ddna_version: string;
  vectors: Array<{
    id: string;
    expected_verified: boolean;
    tests: string;
    spec_reference: string;
  }>;
}

interface ExpectedResult {
  verified: boolean;
  verificationMethod: string;
  created: string;
  expectedReason: string | null;
}

const index: VectorIndex = JSON.parse(
  readFileSync(join(VECTORS_DIR, 'INDEX.json'), 'utf-8')
);

// Current spec version, derived from the installed edm-spec package (the
// canonical source of truth per ADR-0030). Never hardcode this.
const SPEC_PKG_VERSION: string = JSON.parse(
  readFileSync(require.resolve('edm-spec/package.json'), 'utf-8')
).version;

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

/** Compare two x.y.z semver strings: negative if a < b, 0 if equal, positive if a > b */
function semverCompare(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/**
 * Map implementation-specific error messages to canonical reason categories.
 * Per edm-spec test-vectors/README.md:
 * "Verify reason category matches (implementation-specific wording allowed)"
 */
function matchesReasonCategory(reason: string | undefined, expectedCategory: string | null): boolean {
  if (expectedCategory === null) {
    // Valid case - no reason expected
    return reason === undefined;
  }

  if (!reason) {
    return false;
  }

  const reasonLower = reason.toLowerCase();

  switch (expectedCategory) {
    case 'INVALID_SIGNATURE':
      return reasonLower.includes('signature verification failed') ||
             reasonLower.includes('invalid signature');

    case 'MISSING_PROOF':
      return reasonLower.includes('missing proof') ||
             reasonLower.includes('missing field \'proof\'');

    case 'MALFORMED_PROOF_VALUE':
      return reasonLower.includes('decode proofvalue') ||
             reasonLower.includes('proofvalue') ||
             reasonLower.includes('base58') ||
             reasonLower.includes('invalid signature length');

    case 'INVALID_PROOF_STRUCTURE':
      return reasonLower.includes('invalid proof structure') ||
             reasonLower.includes('missing field');

    case 'DID_RESOLUTION_FAILED':
      return reasonLower.includes('failed to resolve') ||
             reasonLower.includes('resolution failed');

    case 'DID_WEB_NO_RESOLVER':
      return reasonLower.includes('did:web requires didresolver') ||
             reasonLower.includes('did:web') && reasonLower.includes('resolver');

    case 'PROOF_EXPIRED':
      return reasonLower.includes('expired') ||
             reasonLower.includes('proof has expired');

    case 'PROOF_FUTURE':
      return reasonLower.includes('future') ||
             reasonLower.includes('created timestamp is in the future');

    default:
      return false;
  }
}

describe('Conformance Test Suite', () => {
  describe('Test vector metadata', () => {
    test('INDEX.json loads correctly', () => {
      // Format assertions only — no hardcoded version literals. The vectors
      // ship with the installed edm-spec package and may be stamped with a
      // HISTORICAL spec version (a conforming reader accepts envelopes of
      // multiple historical EDM versions; edm_version is recorded, not gated).
      expect(index.version).toMatch(SEMVER_RE);
      expect(index.spec_version).toMatch(SEMVER_RE);
      expect(index.ddna_version).toBeTruthy();
      expect(index.vectors.length).toBeGreaterThan(0);

      // Historical acceptance, made explicit: the vectors' spec_version must
      // not be NEWER than the installed spec package version (vectors from
      // the future would mean the dependency pin is broken).
      expect(
        semverCompare(index.spec_version, SPEC_PKG_VERSION),
        `test-vector spec_version ${index.spec_version} is newer than installed edm-spec ${SPEC_PKG_VERSION}`
      ).toBeLessThanOrEqual(0);
    });

    test('installed edm-spec full-profile example stamps the current spec version', () => {
      // Derivation lockstep check: the canonical example artifact in the
      // installed spec package must carry meta.version === the spec package
      // version. If this fails, the spec release cut is internally
      // inconsistent — report upstream, do not patch here.
      const examplePath = require.resolve('edm-spec/examples/example-full-profile.json');
      const example = JSON.parse(readFileSync(examplePath, 'utf-8'));
      expect(example.meta?.version).toBe(SPEC_PKG_VERSION);
    });
  });

  describe('Canonical test vectors', () => {
    for (const vector of index.vectors) {
      test(`${vector.id}: ${vector.tests}`, async () => {
        const vectorDir = join(VECTORS_DIR, vector.id);

        // Load envelope.ddna (per INDEX.json vector.id directory structure)
        const envelope = JSON.parse(
          readFileSync(join(vectorDir, 'envelope.ddna'), 'utf-8')
        );

        // Load expected.json (per edm-spec test-vectors/README.md)
        const expected: ExpectedResult = JSON.parse(
          readFileSync(join(vectorDir, 'expected.json'), 'utf-8')
        );

        // Per edm-spec test-vectors/README.md:
        // "Skip timestamp checks for deterministic test results"
        // Exception: vector 010 tests expired proof - we need timestamp check
        const skipTimestampCheck = vector.id !== '010-expired-proof';

        // For vector 009 (did:web no resolver), do NOT pass a didResolver
        // Per ADR-0020 §"did:web Resolution": verify() should return DID_WEB_NO_RESOLVER
        const result = await verify(envelope, { skipTimestampCheck });

        // Assert verification result matches expected
        expect(result.valid).toBe(expected.verified);

        // Assert reason category matches for invalid cases
        if (!expected.verified) {
          expect(
            matchesReasonCategory(result.reason, expected.expectedReason),
            `Expected reason category "${expected.expectedReason}" but got: "${result.reason}"`
          ).toBe(true);
        }

        // For valid cases, verify method should match
        if (expected.verified && result.valid) {
          expect(result.verificationMethod).toBe(expected.verificationMethod);
        }
      });
    }
  });
});
