# Stripe and booking integration — current setup

## Server-side architecture

- `functions/_lib/booking.js`: shared server-side price calculation, required-field validation, booking-date and arrival-window validation.
- `functions/api/config.js`: exposes only `STRIPE_PUBLISHABLE_KEY`.
- `functions/api/create-checkout-session.js`: validates the booking, recalculates the amount in EUR, writes a pending D1 record, then creates a Stripe Custom Checkout Session.
- `functions/api/booking-status.js`: verifies the Checkout Session directly with Stripe before the website displays a paid receipt.
- `functions/api/create-booking.js`: persists cash bookings in D1 as `cash_due`.
- `functions/api/stripe-webhook.js`: verifies Stripe signatures and updates paid/expired booking status; processed event IDs are stored to avoid duplicate handling.
- `migrations/0001_create_bookings.sql`: D1 schema for bookings and webhook events.

## Cloudflare Pages configuration required

1. Create a D1 database (suggested name: `one-call-bookings`).
2. Apply `migrations/0001_create_bookings.sql`.
3. Add a D1 binding named exactly `BOOKINGS_DB` in Pages → Settings → Functions → D1 database bindings. Bind the database in both Production and Preview as applicable.
4. Configure:
   - `STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_SECRET_KEY` (server-side secret; never place in HTML)
   - `STRIPE_WEBHOOK_SECRET`
5. In Stripe Dashboard, configure webhook URL `https://YOUR-DOMAIN/api/stripe-webhook` for:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
6. Use matching Stripe test keys and webhook secret in Preview/Test first. Do not accept live payments until a successful end-to-end test is completed.

## Checkout details

- Stripe Checkout Session mode: `payment`.
- Checkout UI mode: `custom` (required by the Custom Checkout Elements SDK used in the website).
- Amount: calculated server-side from the selected service and add-ons; currency is EUR.
- No Stripe Product or fixed Price ID is required.
- Apple Pay / Google Pay availability depends on Stripe payment-method settings, device/browser eligibility, and domain verification.
- The browser must supply the complete booking (service, scope, date, time, contact details and address) before checkout session creation.
- A successful client-side confirmation is not treated as proof of payment. The return page checks the session with Stripe, and the signed webhook is the durable payment update.

## End-to-end test checklist

- Test each service type and add-on combination against the displayed total.
- Verify Post-Renovation pricing is included in the server calculation.
- Confirm empty name, phone, email, address, date or invalid email is rejected before payment.
- Confirm invalid/unsupported arrival windows are rejected server-side.
- Complete a Stripe test payment and confirm the D1 row becomes `paid`.
- Abandon a Checkout Session and confirm the expiry webhook updates it to `expired`.
- Create a cash booking and confirm the D1 row becomes `cash_due`.
- Verify repeated webhook delivery does not create duplicate event records or duplicate bookings.
- Test Apple Pay / Google Pay on eligible devices after enabling and verifying the domain in Stripe.

## Important limitation before launch

The source-code integration is now prepared, but a real Cloudflare D1 database binding and Stripe environment secrets must be configured in the Cloudflare and Stripe dashboards. Those account-level settings cannot be inferred or safely created from this repository. Follow `DEPLOYMENT.md` before publishing live payments.
