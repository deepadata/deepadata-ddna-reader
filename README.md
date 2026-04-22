# ddna-reader

Read-only tools for inspecting, validating, and verifying `.ddna` envelopes.

## What This Package Does

- **Inspect** `.ddna` envelope contents in human-readable or JSON format
- **Validate** envelope structure against the expected schema
- **Verify** Ed25519 cryptographic signatures (eddsa-jcs-2022 cryptosuite)
- **Read** governance metadata, EDM payload structure, and proof details

## What This Package Does NOT Do

- **Seal** or sign envelopes (use [ddna-tools](https://github.com/emotional-data-model/ddna-tools))
- **Generate** signing keys (use [ddna-tools](https://github.com/emotional-data-model/ddna-tools))
- **Registry lookup** (use [DeepaData API](https://deepadata.com))

For Certified (Level 3) attestation on Extended or Full profile artifacts, see [deepadata.com](https://deepadata.com).

## Installation

```bash
npm install ddna-reader
```

Or use directly with npx:

```bash
npx ddna-reader inspect <file>
npx ddna-reader verify <file>
```

## CLI Usage

### Inspect an envelope

Display envelope contents in human-readable format:

```bash
ddna-reader inspect envelope.ddna
```

Output as JSON:

```bash
ddna-reader inspect envelope.ddna --json
```

### Validate structure

Check if an envelope has valid structure (schema validation only):

```bash
ddna-reader validate envelope.ddna
```

Treat warnings as errors:

```bash
ddna-reader validate envelope.ddna --strict
```

### Verify signature

Verify the cryptographic signature on an envelope:

```bash
ddna-reader verify envelope.ddna
```

Output as JSON (for scripting):

```bash
ddna-reader verify envelope.ddna --json
```

Example JSON output:

```json
{
  "verified": true,
  "signer_did": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  "created": "2026-04-21T10:00:00Z",
  "errors": []
}
```

Exit codes:
- `0` - Verification succeeded
- `1` - Verification failed or error occurred

## Library Usage

### Basic inspection

```typescript
import {
  inspect,
  inspectEnvelope,
  inspectJson,
  validateStructure,
} from 'ddna-reader';

// Read a .ddna file
const envelope = JSON.parse(fs.readFileSync('artifact.ddna', 'utf-8'));

// Get human-readable inspection
const output = inspect(envelope);
console.log(output);

// Get structured inspection result
const result = inspectEnvelope(envelope);
console.log(result.jurisdiction);
console.log(result.schemaVersion);

// Validate structure only
const validation = validateStructure(envelope);
if (validation.valid) {
  console.log('Structure is valid');
} else {
  console.log('Errors:', validation.errors);
}
```

### Verification

```typescript
import { verify, verifySync } from 'ddna-reader';

const envelope = JSON.parse(fs.readFileSync('artifact.ddna', 'utf-8'));

// Async verification (recommended)
const result = await verify(envelope);
if (result.valid) {
  console.log('Verified by:', result.verificationMethod);
  console.log('Signed at:', result.created);
} else {
  console.log('Verification failed:', result.reason);
}

// Sync verification (did:key only)
const syncResult = verifySync(envelope);
```

### Verification with did:web (injected resolver)

By default, `did:key` signatures verify offline. For `did:web` signatures, you must provide a resolver function:

```typescript
import { verify, didToPublicKey } from 'ddna-reader';

const result = await verify(envelope, {
  didResolver: async (did) => {
    // Handle did:key locally
    if (did.startsWith('did:key:')) {
      const didPart = did.split('#')[0];
      return didToPublicKey(didPart);
    }

    // Handle did:web via HTTP fetch
    if (did.startsWith('did:web:')) {
      const domain = did.slice(8).split('#')[0].replace(/:/g, '/');
      const url = `https://${domain}/.well-known/did.json`;
      const doc = await fetch(url).then(r => r.json());

      // Extract public key from DID document
      const vm = doc.verificationMethod?.find(
        (m: any) => m.id === did || m.id === `${did.split('#')[0]}#${did.split('#')[1]}`
      );
      if (!vm?.publicKeyMultibase) {
        throw new Error('No public key found in DID document');
      }
      // Decode multibase key (implementation depends on format)
      return decodeMultibaseKey(vm.publicKeyMultibase);
    }

    throw new Error(`Unsupported DID method: ${did}`);
  }
});
```

This pattern keeps the library offline-capable while allowing callers to provide their own network policy.

### Verification options

```typescript
const result = await verify(envelope, {
  // Clock skew tolerance (default: 5 minutes)
  clockSkewMs: 10 * 60 * 1000,

  // Skip timestamp validation
  skipTimestampCheck: true,

  // Custom DID resolver (required for did:web)
  didResolver: async (did) => { /* ... */ },
});
```

## Envelope Structure

A `.ddna` envelope contains three components:

```json
{
  "ddna_header": {
    "ddna_version": "1.1",
    "created_at": "2026-02-19T10:00:00Z",
    "edm_version": "0.7.0",
    "jurisdiction": "GDPR",
    "consent_basis": "consent",
    "exportability": "allowed",
    "retention_policy": { ... }
  },
  "edm_payload": {
    "meta": { ... },
    "core": { ... },
    "constellation": { ... },
    "governance": { ... }
  },
  "proof": {
    "type": "DataIntegrityProof",
    "cryptosuite": "eddsa-jcs-2022",
    "verificationMethod": "did:key:z6Mk...",
    "proofPurpose": "assertionMethod",
    "proofValue": "z..."
  }
}
```

## Architecture

The `.ddna` envelope format uses W3C Data Integrity Proofs with Ed25519 signatures.

- **Sealing** (Level 2 - Sealed) is open: anyone can seal artifacts with their own Ed25519 keys using [ddna-tools](https://github.com/emotional-data-model/ddna-tools)
- **Verification** is open: anyone can verify signatures using this package
  - `did:key` verification works offline
  - `did:web` verification requires a caller-provided resolver
- **Certification** (Level 3 - Certified) is commercial: DeepaData provides third-party attestation for Extended and Full profile artifacts

### Verification vs. Registry Lookup

| Operation | ddna-reader (OSS) | /v1/verify (API) |
|-----------|-------------------|------------------|
| Signature verification | ✓ | ✓ |
| Structure validation | ✓ | ✓ |
| Registry lookup | ✗ | ✓ |
| Conformance attestation | ✗ | ✓ |

### Timestamp Attestation

The `proof.created` timestamp is signer-attested per [W3C Data Integrity](https://www.w3.org/TR/vc-data-integrity/), not independently timestamped via RFC 3161. This means:

- The timestamp indicates when the signer claims to have signed
- For legal non-repudiation requiring trusted timestamping, use the DeepaData API

## Related

- [emotionaldatamodel.org](https://emotionaldatamodel.org) - Open specification for the Emotional Data Model
- [ddna-tools](https://github.com/emotional-data-model/ddna-tools) - Sealing and key generation tools
- [deepadata.com](https://deepadata.com) - Certification authority for Level 3 attestation
- [deepadata-edm-spec](https://github.com/emotional-data-model/edm-spec) - Canonical EDM schema and examples

## License

MIT
