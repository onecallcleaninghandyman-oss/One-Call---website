# Stripe test environment

This branch is intended for isolated Stripe test-mode checkout verification.

## Cloudflare Pages Preview settings

Configure these under the **Preview** environment only. Do not change Production values.

- `STRIPE_PUBLISHABLE_KEY`: Stripe test publishable key (`pk_test_...`)
- `STRIPE_SECRET_KEY`: Stripe test secret key (`sk_test_...`)
- `STRIPE_WEBHOOK_SECRET`: signing secret for the test webhook endpoint below
- `BOOKINGS_DB`: D1 binding to `one-call-bookings-preview` (already configured)

The production environment continues to use its existing live Stripe keys and `one-call-bookings` database.

## Stripe test webhook

After Cloudflare creates the Preview deployment for this branch, create a webhook destination in Stripe **Test mode** pointing to:

`https://<this-branch-preview-host>/api/stripe-webhook`

Subscribe to:
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`

Copy the endpoint's signing secret into the Preview `STRIPE_WEBHOOK_SECRET` secret in Cloudflare. Never use the Live-mode webhook secret here.

## Test procedure

Use clearly marked test customer details and Stripe's official test card number `4242 4242 4242 4242`, a future expiry date, and any 3-digit CVC. Verify:
1. Checkout completes in Stripe Test mode.
2. The test Stripe Customer is created/reused.
3. Exactly one paid booking and one customer row are written to the preview D1 database.
4. Repeating a payment with the same email reuses the Stripe Customer.
5. An abandoned or failed checkout creates no booking/customer rows.

Do not enter real card details. Do not use the Production site for this test.
