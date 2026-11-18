# One Call Cleaning — deployment checklist

## Cloudflare Pages setup (required before accepting bookings)

1. Create a Cloudflare D1 database named `one-call-bookings`.
2. Run `migrations/0001_create_bookings.sql` against the database.
3. In Cloudflare Pages → Settings → Functions → D1 database bindings, add binding name **`BOOKINGS_DB`** and select `one-call-bookings`. Configure Production and Preview separately.
4. Set environment variables for the correct environment:
   - `STRIPE_PUBLISHABLE_KEY` — Stripe publishable key.
   - `STRIPE_SECRET_KEY` — matching Stripe secret key; keep server-side.
   - `STRIPE_WEBHOOK_SECRET` — signing secret for the webhook endpoint.
5. In Stripe Dashboard, add endpoint `https://YOUR-DOMAIN/api/stripe-webhook` and subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`.
6. Deploy the GitHub changes. Verify `/api/config` returns only the publishable key.
7. Test in Stripe test mode: paid card booking becomes `paid` in D1; cash booking becomes `cash_due`. Switch to live keys only after successful tests.

## Routes

- `GET /api/config`: publishable Stripe key only.
- `POST /api/create-checkout-session`: validates all required details, recalculates price server-side, saves pending booking, creates embedded Checkout Session.
- `GET /api/booking-status`: checks session with Stripe before the browser shows a paid receipt.
- `POST /api/create-booking`: saves cash booking to D1.
- `POST /api/stripe-webhook`: verifies Stripe signature and idempotently updates booking status.

The existing One Call navy/emerald design and four-step booking interface are retained. No Stripe Products or fixed Price IDs are required; prices are generated server-side from the selected booking.
