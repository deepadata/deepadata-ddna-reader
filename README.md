# deepadata-ddna-reader

Read-only tools for inspecting and validating `.ddna` envelope structure.

## What This Package Does

- **Inspect** `.ddna` envelope contents in human-readable or JSON format
- **Validate** envelope structure against the expected schema
- **Read** governance metadata, EDM payload structure, and proof details

## What This Package Does NOT Do

- **Seal** or sign envelopes (requires DeepaData API)
- **Verify** cryptographic signatures (requires DeepaData API)
- **Generate** signing keys (requires DeepaData API)

For sealing, signature verification, and certification, use the [DeepaData API](https://deepadata.com).

## Installation

```bash
npm install deepadata-ddna-reader
```

Or use directly with npx:

```bash
npx deepadata-ddna-reader inspect <file>
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

## Library Usage

```typescript
import {
  inspect,
  inspectEnvelope,
  inspectJson,
  validateStructure,
} from 'deepadata-ddna-reader';

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

## Envelope Structure

A `.ddna` envelope contains three components:

```json
{
  "ddna_header": {
    "ddna_version": "1.1",
    "created_at": "2026-02-19T10:00:00Z",
    "edm_version": "0.6.0",
    "jurisdiction": "AU",
    "consent_basis": "explicit_consent",
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

## Why Read-Only?

DeepaData operates as a certification authority for emotional data governance. The `.ddna` envelope format uses cryptographic signatures to ensure data integrity and provenance.

- **Schema validation** can be done locally (this package)
- **Signature verification** requires the DeepaData registry to confirm certificate authenticity
- **Sealing** requires DeepaData's signing infrastructure

This is similar to SSL certificates: anyone can read a certificate, but only trusted Certificate Authorities can issue certificates that browsers trust.

## Related

- [emotionaldatamodel.org](https://emotionaldatamodel.org) - Open specification for the Emotional Data Model
- [deepadata.com](https://deepadata.com) - Certification authority and API for sealing and verification
- [deepadata-edm-spec](https://github.com/emotional-data-model/edm-spec) - Canonical EDM schema and examples
- [deepadata-edm-sdk](https://github.com/deepadata/deepadata-edm-sdk) - LLM-assisted EDM extraction SDK

## License

MIT
