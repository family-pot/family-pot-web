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

```bash
git clone https://github.com/family-pot/family-pot-web.git
cd family-pot-web
pnpm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL to your running family-pot-api
pnpm dev                     # http://localhost:3000
```

Run everything CI runs:

```bash
pnpm check   # format:check, lint, typecheck, test, build
```

`pnpm check` is exactly the command used by the GitHub Actions workflow. CI uses
Node 22 and installs with `pnpm install --frozen-lockfile`.

## Shared layout and state components

The root layout in `app/layout.tsx` provides the header, primary navigation, footer, skip
link and `<main>` landmark. `Dashboard`, `Recipients` and `Transfers` are placeholder routes
reachable from the navigation on desktop and narrow screens.

Reusable UI lives in `src/components`:

- `LoadingState` — `role="status"`, polite live region and an optional label.
- `ErrorState` — `role="alert"`, a message and an optional `onRetry` callback.
- `EmptyState` — a title, optional description and optional action.
- `SiteHeader` / `SiteFooter` — the shared frame.

All controls use native elements, visible focus styles and semantic landmarks. Import
components from `@/src/components`.

## How data works in this repo

All page and component data goes through `src/data/index.ts`. It exports a single
`DataSource` with `recipients` and `transfers` repositories, each supporting `list`, `get`,
`create`, `update` and `delete`. The data source is chosen once from
`NEXT_PUBLIC_DATA_SOURCE`:

- `mock` (default) — `MockDataSource` keeps an in-memory store seeded from
  `src/data/sample-data.ts`. The sample records are fake and clearly labelled; amounts,
  exchange rates and fees are decimal strings. A short artificial delay and an optional
  failure mode make loading and error states easy to exercise.
- `api` — `ApiDataSource` is a typed stub that throws "not connected" until the backend is
  wired up. It never fabricates a successful response.

Pages should import `getDataSource()` (or the shared `dataSource`) and must not import
sample data directly. Switching implementations later changes this one module, not the UI.

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_DATA_SOURCE` or
`NEXT_PUBLIC_API_URL` when needed.

Recipients use ISO 3166-1 alpha-2 country codes (for example `NG`) and have an optional
`notes` field. Validation lives in `src/data/recipient-validation.ts` and is shared by the form
and the data sources; the mock rejects deleting a recipient that still has transfers.

## Recipients page

`/recipients` (`src/components/recipients`) lists recipients with loading, empty and error
states, and supports add, edit and delete (with confirmation). Field errors, whether from client
validation or returned by the data layer, appear next to the field. Pass a `dataSource` prop to
`RecipientsView` in tests.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the shared guidelines in family-pot-docs. Issues are
sized for Drips Wave (Trivial 100 / Medium 150 / High 200 points).

## Security

See [SECURITY.md](SECURITY.md). This app never requests, stores or logs a Stellar secret key.

## License

MIT — see [LICENSE](LICENSE).
