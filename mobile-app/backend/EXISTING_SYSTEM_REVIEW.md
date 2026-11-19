# Existing website integration findings

Reviewed from the current `main` branch:
- Cloudflare Pages Functions are used under `functions/api/`.
- Existing D1 binding name is `BOOKINGS_DB`.
- Existing data model includes `bookings`, `customers`, and `stripe_events`.
- Customer identity in the current webhook is keyed by normalized email; booking rows store customer contact fields and a `customer_id`.
- Stripe checkout calculates its amount on the server via `functions/_lib/booking.js`.
- Stripe webhook verifies the Stripe signature and handles duplicate event IDs via `stripe_events`.

Important gaps before a safe production app:
1. The current website checkout creates a booking only after Stripe confirms payment; worker scheduling/assignment and job completion status are not implemented in the inspected webhook.
2. There is no verified app sign-in/session or role-based access API in the inspected files.
3. A completed-booking timestamp/status is not yet written by the inspected webhook. Therefore the requested 30-day discount must not be activated until a manager-controlled completion workflow and exact D1 columns/status values are confirmed.
4. Existing payment flow should remain unchanged while mobile endpoints are developed separately.
5. Worker balances require an append-only ledger and reconciled payout workflow; do not infer balances from Stripe customer records.

## Integration decision
Extend the existing `BOOKINGS_DB` database and existing `bookings` records. Do not create a second bookings table. New mobile-specific tables are prefixed with `mobile_` or `worker_` and are isolated from the current website checkout until tested.

The schema file is a proposed migration, not yet applied to Cloudflare D1. Back up and inspect production schema before applying.
