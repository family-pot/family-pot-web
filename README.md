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

## Authentication (mock, development only)

Sign-up, login and logout work end to end against a **mock auth provider** so the UI and protected routes are ready before the real API (ADR 0005) is connected. **The mock is for development only.**

- `AuthProvider` (`src/auth/types.ts`) is the only thing the UI talks to: `getSession`, `signUp`, `signIn`, `signOut`. `MockAuthProvider` accepts **any well-formed email and a password of at least 12 characters** (there are no accounts); `ApiAuthProvider` is a stub that fails loudly. They are chosen with the same switch as the data layer, `NEXT_PUBLIC_DATA_SOURCE=mock|api` (default `mock`).
- The session is held **in memory only**. Nothing is written to `localStorage`, `sessionStorage` or cookies, the password is checked and dropped (never kept in the session or on the provider, never logged), so **reloading the page signs you out**. Tests enforce all of this.
- Only `/login` and `/signup` are public. Every other page, including `/`, needs a session: while signed out a protected page is **not rendered at all**, and the person is sent to `/login?next=<the page they wanted>`, then brought back after signing in. The `next` value must be a path inside this site (anything else, such as `https://...`, `//host` or a login page, is ignored), so the redirect cannot be abused.
- The sign-up form requires a password of 12 to 128 characters. Failures show a single generic message ("Could not log in. Check your email and password and try again.") and never say whether an email exists or which part was wrong. Log out is in the header and clears the session.

The real implementation (tokens, refresh, cookies) belongs to the later connect issue.

## Transfers page

`/transfers` (`src/components/transfers`) lists transfers newest first as cards on phones and rows from the `md` breakpoint: date, recipient, amount, fee, provider and status, each amount with a provenance badge. Filters (recipient, date range, provider, status) and the page position live in the **URL query string**, so reloading a link, sharing it, or using back/forward restores the same view:

`/transfers?recipient=<id>&from=2026-01-01&to=2026-06-30&provider=Wise&status=completed&cursor=<opaque>`

Invalid or unknown values in the URL are ignored rather than breaking the page. Pagination is cursor-based (`First page` / `Next page`; use the browser's back button to go to an earlier page), matching the API (family-pot-api API-12), so a page never repeats or skips a transfer when data changes. The mapping between the URL and the filters is in `src/lib/transfer-url.ts`.

### Adding and editing a transfer

`/transfers/new` and `/transfers/<id>/edit` use `TransferForm` (`src/components/transfers/transfer-form.tsx`): recipient, date, amount, sending and receiving currency, exchange rate, fee (in the sending currency), provider, purpose, status and notes. Edit mode also has **Delete transfer**, which asks for confirmation first.

What a person types is text. On submit it is converted **with string maths only, never a JavaScript float** (`src/lib/decimal-input.ts`): `"100.10"` becomes `"10010"` minor units, so it is stored and shown as exactly 100.10 (floats would turn `1.15 * 100` into `114.99999999999999`). The conversion follows the currency's decimal places and rejects extra decimals (`1.005` GBP is an error, not a silent rounding). The exchange rate is kept as a canonical decimal string (`"1950.50"` is stored as `"1950.5"`). A blank fee means no fee.

Validation happens in the browser and again in the data layer, from one shared module (`src/data/transfer-validation.ts`): a positive amount, a non-negative fee, supported currencies (GBP, USD, EUR, CAD, NGN, GHS, KES, INR, PHP), a positive rate with at most 12 decimals, a real date from 2000-01-01 to at most 1 day after today, and length limits. Each problem is shown next to its field, and errors returned by the data layer are shown the same way. The form says plainly that everything entered is _user-entered_.

### Data layer changes for transfers

`transfers.list(query)` now takes the filters (`recipientId`, `dateFrom`, `dateTo`, `provider`, `status`, `limit`, `cursor`) and returns `{ items, limit, hasMore, nextCursor }`. `Transfer` now has `transferDate`, `receivingCurrency`, `provider` (and optional `purpose`, `notes`), and **amounts and fees are minor-unit strings** as in ADR 0004 (`"25000"` with GBP is 250.00), not decimal major units. The mock and the sample data follow this; the API stub still throws "not connected".

## Recipients page

`/recipients` (`src/components/recipients`) lists recipients with loading, empty and error
states, and supports add, edit and delete (with confirmation). Field errors, whether from client
validation or returned by the data layer, appear next to the field. Pass a `dataSource` prop to
`RecipientsView` in tests.

## Money and provenance

Amounts follow [ADR 0004](https://github.com/family-pot/family-pot-docs/blob/main/adr/0004-money-representation.md): a **string of whole minor units** plus a currency code (`"15000"` with `GBP` is 150.00). Never use `number` arithmetic on money. `src/lib/money.ts` formats amounts without ever turning them into a float:

```ts
import { formatMoney } from "@/src/lib/money";

formatMoney("15000", "GBP"); // "£150.00"
formatMoney("28500", "JPY", "en-US"); // "¥28,500"        (0 decimals)
formatMoney("3800", "KWD", "en-US"); // "KWD 3.800"      (3 decimals)
formatMoney("9007199254740993", "JPY", "en-US"); // "¥9,007,199,254,740,993" (exact beyond 2^53)
```

`formatMoney` throws a `MoneyFormatError` for anything that is not a valid amount or a known currency, rather than showing a wrong number. It passes a decimal _string_ to `Intl.NumberFormat`, which formats it exactly. The default locale is `en-GB`; pass another locale as the third argument. `minorUnitsToDecimal` and `currencyExponent` are exported for lower-level use.

Every displayed number should say where it came from. `ProvenanceBadge` shows one of four values, each with its own text and symbol (never colour alone), a description for screen readers and a tooltip:

```tsx
import { ProvenanceBadge } from "@/src/components";

<ProvenanceBadge provenance="user-entered" />  {/* ✎ Entered by you */}
<ProvenanceBadge provenance="calculated" />    {/* = Calculated */}
<ProvenanceBadge provenance="estimated" />     {/* ≈ Estimated: bold, dashed, with a "not guaranteed" tooltip */}
<ProvenanceBadge provenance="verified" />      {/* ✓ Verified */}
```

`estimated` is deliberately heavier so it cannot be mistaken for a fact. Pass children to replace the label (the description is kept).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the shared guidelines in family-pot-docs. Issues are
sized for Drips Wave (Trivial 100 / Medium 150 / High 200 points).

## Security

See [SECURITY.md](SECURITY.md). This app never requests, stores or logs a Stellar secret key.

## License

MIT — see [LICENSE](LICENSE).
