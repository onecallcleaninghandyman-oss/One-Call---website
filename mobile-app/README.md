# One Call Mobile App

Separate Flutter application for Android and iOS, integrated with the existing One Call website through the shared backend API.

## Current status
This is the initial application foundation. It is intentionally isolated under `mobile-app/`; it does not change the existing website or its payment flow.

## Planned roles
- Customer: booking, booking history, eligible repeat-customer discount, profile.
- Worker: assigned/open jobs, crew details, full payment history, receivables/payables, profile and company contacts.
- Manager: staff, customers, bookings, finance, account deletion approval and audit.

## Development
Install Flutter (stable), then:
```sh
cd mobile-app
flutter pub get
flutter run
```

## Backend contract
The mobile app must use the same authenticated API and canonical booking/finance records as the website. Never trust totals, discount eligibility, worker balances, or role claims supplied by the client. The server recalculates them and writes immutable ledger entries.

## Important business rules
- Repeat-customer discount: apply only if the same customer has a previous booking with status `completed` and its completion timestamp is within the preceding 30 days. A pending, cancelled, or older booking does not qualify. Server-side check only.
- Worker account deletion: workers may submit a deletion request, but only a manager may approve and execute account deactivation/deletion. Financial records subject to statutory retention must be retained/pseudonymised as required.
- Finance: maintain an append-only ledger. Do not calculate balances from mutable display fields or directly edit historical transactions.
- Stripe: payment confirmation comes from a verified webhook, not from a client redirect or app screen.

## Next implementation steps
1. Confirm and document the existing D1 schema and deployed Cloudflare bindings.
2. Add authenticated API endpoints and migrations without breaking current website routes.
3. Connect this Flutter client to the deployed API.
4. Implement Stripe test-mode flows and webhook idempotency.
5. Test role isolation, booking concurrency, ledger reconciliation, and deletion retention before live launch.
