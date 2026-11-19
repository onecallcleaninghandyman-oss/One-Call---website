# One Call Staff App

A separate Flutter application for Android and iOS, connected to the existing One Call website backend and shared D1 database.

## App access: exactly five staff groups
1. **Cleaner** (`cleaner`)
2. **Upholstery / chemical cleaning specialist** (`upholstery_cleaner`)
3. **Handyman** (`handyman`)
4. **Manager** (`manager`)
5. **Owner** (`owner`) — the business owner, with highest-level access.

**Customers do not have accounts and do not log in to this app.** Customer bookings and contact details remain in the existing website/database. There is no customer role, customer registration, or customer-facing app screen.

## Backend integration
- Reuse the existing Cloudflare Pages Functions backend and `BOOKINGS_DB` D1 binding.
- Existing website tables `bookings`, `customers`, and `stripe_events` remain canonical.
- New mobile staff tables extend the existing database; do not create a parallel booking system.
- All roles and permissions must be checked on the server from a verified session. Never trust a role sent by the app.
- Staff accounts are created/invited by authorized management; no public self-registration.

## Business rules
- Customer discounts are implemented exclusively on the existing website booking/checkout flow. They are not part of this staff app. The website backend must calculate eligibility and discount before creating the Stripe payment session; only a previous booking with status `Completed` and a completion timestamp within the preceding 30 days qualifies.
- Worker balances are calculated from an append-only ledger.
- Preserve the agreed weekly settlement cycle: Monday totals are fixed; Monday–Wednesday is the repayment window; debtors are blocked Thursday morning; worker payouts are made Thursday.
- Worker account deletion is manager-controlled. Financial records must be retained as required by law.
- Stripe payment confirmation comes from a verified webhook, never from a client redirect.

## Development
Install Flutter stable, then run `flutter pub get` and `flutter run` from this directory.

The SQL migration in `backend/` is proposed and has not been applied to production.