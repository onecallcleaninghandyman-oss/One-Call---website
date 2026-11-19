# One Call Cleaning — deployment checklist

## Existing Cloudflare Pages and D1 setup

1. Confirm the Pages project uses the existing D1 binding named BOOKINGS_DB in Production and Preview.
2. No D1 schema migration is required for the website loyalty-discount and tip changes in this release. The pricing breakdown and future completion markers are stored in the existing bookings.booking_json column; customer pre-registration uses the existing customers table.
3. Confirm the existing Stripe secrets are configured for the correct environment:
   - STRIPE_PUBLISHABLE_KEY — Stripe publishable key.
   - STRIPE_SECRET_KEY — server-side secret; never expose it to the browser.
   - STRIPE_WEBHOOK_SECRET — webhook signing secret.
4. In Stripe Dashboard, verify the webhook endpoint https://YOUR-DOMAIN/api/stripe-webhook subscribes to checkout.session.completed and checkout.session.async_payment_succeeded.
5. Deploy the main branch only after the pull request is merged. Verify /api/config returns only the publishable key.
6. Run an end-to-end test with Stripe test keys before enabling or relying on live payments.

## Repeat-customer discount

- The website applies an automatic 10% discount only when the same normalized customer email/customer_id has a previous booking marked completed, with a completion timestamp within the preceding 30 days.
- The discount is calculated by the server against the service and selected add-ons. The browser cannot submit or override the discount.
- A payment alone does not make a job completed. A trusted staff/manager workflow must write jobStatus='completed' and completedAt into booking_json after the work is actually finished. Until that workflow exists and records completions, customers will not qualify merely because they paid.
- Cancelled, scheduled, and older completed bookings do not qualify.

## Customer tips and Stripe

- Before payment, the website pre-registers customer contact details in D1 without incrementing bookings_count.
- The customer may enter an optional tip in the embedded payment form. The tip is added to the payment and is not discounted.
- Stripe Checkout receives each selected service/add-on as a separate line item and the tip as a separate Customer Tip line item.
- Stripe Session and PaymentIntent metadata include subtotal, discount percentage/amount, tip, final total, customer details, booking details, and selected service-item breakdown.
- After successful payment, the webhook stores the paid amount and the complete pricing breakdown in bookings.booking_json and updates the customer record.

## Routes

- GET /api/config — publishable Stripe key only.
- POST /api/create-checkout-session — validates booking, pre-registers customer, calculates discount and tip server-side, creates embedded Stripe Checkout.
- POST /api/create-booking — records cash bookings with the same server-side repeat-customer discount.
- GET /api/booking-status — verifies the Checkout Session with Stripe before showing a paid receipt and can recover a paid booking from verified Stripe metadata.
- POST /api/stripe-webhook — verifies Stripe signatures and persists paid bookings and itemised pricing in D1.

The changes use the existing D1 schema and do not require a migration. Deploy only after reviewing and testing the updated main branch.
