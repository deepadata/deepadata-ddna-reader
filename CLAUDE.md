# ddna-reader

Read-only parser and verifier for .ddna envelopes.

## What This Repo Is

A lightweight library for parsing, displaying, and verifying
.ddna envelopes. No sealing, no key generation — just envelope
parsing, field extraction, and Ed25519 signature verification.

- **Current version:** v0.2.0
- **License:** MIT (open source)
- **Remote:** github.com/emotional-data-model/ddna-reader

## Role in the DeepaData System

```
   ddna-tools (seal, keygen)
       ↓ produces envelopes
→ ddna-reader (parse, verify, display) ← YOU ARE HERE
       ↓ consumed by
   Applications that need to read/verify .ddna files
```

Use ddna-reader when you need to:
- Display envelope contents
- Validate envelope structure
- Verify Ed25519 signatures (did:key offline, did:web with resolver)

Use ddna-tools when you need to:
- Seal/sign envelopes
- Generate signing keys

Use the DeepaData API when you need:
- Registry lookup
- Certified (Level 3) attestation

## What This Repo Does

- Parse .ddna envelope structure
- Extract EDM artifact from envelope
- Display envelope metadata (issuer, created_at, proof)
- Verify Ed25519 signatures (eddsa-jcs-2022 cryptosuite)
  - did:key resolves locally (offline)
  - did:web requires injected resolver (see ADR-0020)

## What This Repo Does NOT Do

- Seal or sign envelopes (use ddna-tools)
- Generate keys (use ddna-tools)
- Registry lookup (use deepadata.com API)
- RFC 3161 trusted timestamping (timestamps are signer-attested
  per W3C Data Integrity specification)

## Architectural Decisions

**ADR-0020: Open Verification in ddna-reader**

Per ADR-0020, verification is open. This aligns with ADR-0004's
stated intent: "the OSS layer establishes the standard and enables
open verification."

Key design decisions:
- `verify()` and `verifySync()` are the primary verification API
- Injected resolver pattern for did:web (library makes no HTTP calls)
- did:key resolves locally by default
- did:web throws if no resolver provided
- Timestamps are signer-attested, not RFC 3161

Source: `deepadata-com/internal_document_series/ADR/ADR-0020-open-verification-in-ddna-reader.md`

## OSS Boundary

This repo is MIT licensed. Read-only and verify-only by design.

Verification is open: anyone can verify. Issuance remains gated.

## Open Items

These are deferred to future versions:

- **Registry lookup** - Remains API-only. Certified status requires
  the /v1/verify endpoint to check registry.
- **RFC 3161 timestamping** - The proof.created timestamp is
  signer-attested per W3C Data Integrity. For legal non-repudiation,
  trusted timestamping would require the DeepaData API.
- **v0.3.0 @deepadata/ddna-verify-core** - Extraction of verify.ts
  and did.ts to a shared private package consumed by both
  ddna-reader and deepadata-com to eliminate version drift.
- **Test vectors** - Canonical test vectors in edm-spec are required
  before npm publish (Phase 2 per ADR-0020).

## Source of Truth

→ **See `deepadata-com/planning/CLAUDE_PROJECT.md`**
