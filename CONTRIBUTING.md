# Contributing to family-pot-web

This is the frontend repo. Shared contribution rules (branching, commits, financial-code rules,
Drips Wave sizing, which repo an issue belongs in) are in
[family-pot-docs/CONTRIBUTING.md](https://github.com/family-pot/family-pot-docs/blob/main/CONTRIBUTING.md) —
read that first.

## This repo, specifically

- Next.js (App Router), TypeScript. UI only — no database access, no Stellar key handling.
- All data comes from [family-pot-api](https://github.com/family-pot/family-pot-api) over REST.
  If a page needs data the API doesn't provide yet, open a linked issue in family-pot-api first.

## Local setup

\`\`\`bash
git clone https://github.com/family-pot/family-pot-web.git
cd family-pot-web
pnpm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL to your running family-pot-api
pnpm dev
\`\`\`

Before opening a PR:

\`\`\`bash
pnpm check   # format:check, lint, typecheck, test, build
\`\`\`

## Scope reminder

If your change needs new backend logic, a new endpoint, or a database change, that work belongs
in `family-pot-api` as a separate, linked issue — not in this repo.
