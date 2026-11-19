# One Call Cleaning — deployment checklist

## Cloudflare Pages setup

1. Confirm the existing Cloudflare D1 database and its BOOKINGS_DB binding.
2. Apply migrations in order if they have not already been applied: 0001_create_bookings.sql, 0002_create_customers.sql, 0003_add_stripe_customer_id.sql, then 0004_repeat_customer_discount_tips.sql.
3. Back up the production D1 database before applying migration 0004. Do not mark historical paid bookings as completed automatically.
4. In Cloudflare Pages → Settings → Functions → D1 database bindings, verify binding name BOOKINGS_DB for Production and Preview.
5. Set STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY (server-side secret), and STRIPE_WEBHOOK_SECRET for the correct environment.
6. In Stripe Dashboard → Payment method domains, register your website domain in test and live modes for wallet eligibility. Enable the payment methods you want to offer.
7. In Stripe Dashboard, configure https://YOUR-DOMAIN/api/stripe-webhook for checkout.session.completed and checkout.session.async_payment_succeeded (also retain failed/expired events if configured).
8. Deploy the GitHub branch after reviewing the changes. Verify /api/config returns only the publishable key.
9. Test with Stripe test keys before enabling live payments.

## Loyalty discount and tips

- The website backend pre-registers customer contact details in D1 before payment. This does not increment bookings_count; an abandoned checkout is not counted as a booking.
- A 10% loyalty discount is automatically applied when the same normalized customer email/customer ID has a booking with job_status='completed' and a real completed_at timestamp within the preceding 30 days.
- The discount is calculated server-side on the service and selected add-ons. Customer-supplied discount values are ignored. Tips are not discounted.
- The customer can enter an optional tip in the embedded Stripe payment form. Stripe receives separate line items for the selected service/add-ons and the tip. Discount amounts and the pricing breakdown are included in Stripe Session/PaymentIntent metadata and stored in D1.
- Existing bookings are not automatically considered completed. A manager-controlled staff workflow must mark a job completed after the work is actually finished. Payment status alone is not proof of completion.

## Routes

- GET /api/config: publishable Stripe key only.
- POST /api/create-checkout-session: validates the booking, recalculates prices, pre-registers the customer, checks completed-booking eligibility, adds the optional tip and creates the embedded Checkout Session.
- GET /api/booking-status: checks the Checkout Session with Stripe before the browser shows a paid receipt.
- POST /api/create-booking: saves cash bookings with the same server-side loyalty discount.
- POST /api/stripe-webhook: verifies Stripe signature and stores the paid booking and itemised payment breakdown.

No fixed Stripe Product or Price IDs are required; prices are generated server-side from the selected booking. The source changes do not become live until deployed, and migration 0004 must be applied to the correct D1 environment first.
