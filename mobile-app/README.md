# One Call Staff App

A separate Flutter application for Android and iOS, connected to the existing One Call website backend and shared D1 database.

## App access: exactly four staff groups
1. **Cleaner** (`cleaner`)
2. **Upholstery / chemical cleaning specialist** (`upholstery_cleaner`)
3. **Handyman** (`handyman`)
4. **Manager** (`manager`) — the highest-privilege role and full administrator of the staff app and operating workflow.

There is no separate owner role or owner-only permission tier. The manager has full management authority.

**Customers do not have accounts and do not log in to this app.** Customer bookings and contact details remain in the existing website/database. There is no customer role, customer registration, or customer-facing app screen.

## Manager permissions
The manager has full operational control, enforced by the backend:
- View all bookings, customers, staff, teams, and staff financial records.
- View each booking's full price, customer discount, worker/cleaner earnings, company share, and final amounts.
- Create and manage staff accounts; assign and reassign workers to bookings; set the required crew size and view team members.
- Change booking dates and times; block and unblock staff accounts.
- Apply customer discounts of 5%–15% through the website checkout backend. The website, not the app, calculates and applies the discount before Stripe Checkout.
- Apply an order bonus of 5%–15%; the bonus calculation basis and recipient must be confirmed before implementation so the ledger is not populated with an assumed formula.

## Backend integration
- Reuse the existing Cloudflare Pages Functions backend and `BOOKINGS_DB` D1 binding.
- Existing website tables `bookings`, `customers`, and `stripe_events` remain canonical.
- New mobile staff tables extend the existing database; do not create a parallel booking system.
- All four roles and permissions must be checked on the server from a verified session. The manager is the highest-privilege role. Never trust a role sent by the app.
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