# Security Policy

This is the frontend repo. The org-wide security policy, vulnerability reporting process, and
design principles are in
[family-pot-docs/SECURITY.md](https://github.com/family-pot/family-pot-docs/blob/main/SECURITY.md) —
read that first.

## This repo, specifically

- This app never requests, stores, or logs a Stellar secret key, and never will.
- No wallet signing happens in this repo. Signing is always done in the user's own wallet.
- Report vulnerabilities privately via GitHub's advisory tool on this repo:
  <https://github.com/family-pot/family-pot-web/security/advisories/new>
