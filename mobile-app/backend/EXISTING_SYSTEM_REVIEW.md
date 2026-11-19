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
3. Migration `0004_repeat_customer_discount_tips.sql` adds `job_status` and `completed_at` to bookings. The checkout backend now applies a 10% discount only when the same customer email/customer_id has a genuinely completed booking in the preceding 30 days. The manager-controlled job-completion workflow still needs to write these fields after work is finished; payment alone must not mark a job completed.
4. The website pre-registers customer contact details in D1 before payment without incrementing `bookings_count`. Abandoned checkouts therefore do not count as bookings.
5. Stripe checkout shows selected services/add-ons as separate line items and the customer-entered tip as a separate, undiscounted line item. Discount amount, tip and total are also stored in Stripe metadata and D1.
6. Customer discounts and tips are website checkout functions, not customer-facing staff-app features.
6. Worker balances require an append-only ledger and reconciled payout workflow; do not infer balances from Stripe customer records.
7. The app has exactly four staff roles: cleaner, upholstery_cleaner, handyman, and manager. Manager is the highest-privilege role; there is no owner role.
8. Manager-facing booking finance must expose gross booking price, customer discount, worker earnings, company share, and net totals. The normal worker earnings/company-share calculation must be defined centrally on the backend and must not be guessed in the app. A manager-awarded cleaner bonus is 5%–15% of that individual cleaner's normal earnings for the booking, not a percentage of the customer's total booking price. It is added on top of normal earnings, paid to the selected cleaner(s), and recorded as a separate append-only ledger entry. The purpose is extra compensation for difficult or unusually dirty jobs.
9. Managers may set customer discounts from 5% to 15%, but the discount is applied by the website backend before Stripe Checkout. The staff app may provide the manager control; it must not become a customer booking/payment interface.
10. Manager controls include all staff and booking records, assignments/reassignments, crew size, booking date/time changes, and staff block/unblock actions. These actions require server-side authorization and audit-log entries.

## Integration decision
Extend the existing `BOOKINGS_DB` database and existing `bookings` records. Do not create a second bookings table. New mobile-specific tables are prefixed with `mobile_` or `worker_` and are isolated from the current website checkout until tested.

The schema file is a proposed migration, not yet applied to Cloudflare D1. Back up and inspect production schema before applying.
