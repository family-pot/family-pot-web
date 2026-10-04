# Family Pot — Web

Frontend for [Family Pot](https://github.com/family-pot), a tracker for people who send money
home regularly. Shows transfer history, dashboard totals, and cost comparisons by calling the
[family-pot-api](https://github.com/family-pot/family-pot-api) REST API.

> How much have I sent my family, how much has it cost me, and how does that compare with other
> routes?

Shared product docs, architecture, roadmap and ADRs live in
[family-pot-docs](https://github.com/family-pot/family-pot-docs) — read that first.

## Status

Early scaffold. Features are built incrementally through GitHub issues. See the roadmap in
family-pot-docs.

## Tech stack

- Next.js (App Router), TypeScript
- Talks to family-pot-api over REST — no direct database access from this repo
- Vitest, ESLint, Prettier

## What this repo does NOT do

- No backend logic, no database, no Stellar key handling — all of that lives in family-pot-api.
- No smart contract.

## Quick start

Requirements: Node 22+, pnpm.

\`\`\`bash
git clone https://github.com/family-pot/family-pot-web.git
cd family-pot-web
pnpm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL to your running family-pot-api
pnpm dev                     # http://localhost:3000
\`\`\`

Run everything CI runs:

\`\`\`bash
pnpm check   # format:check, lint, typecheck, test, build
\`\`\`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the shared guidelines in family-pot-docs. Issues are
sized for Drips Wave (Trivial 100 / Medium 150 / High 200 points).

## Security

See [SECURITY.md](SECURITY.md). This app never requests, stores or logs a Stellar secret key.

## License

MIT — see [LICENSE](LICENSE).
