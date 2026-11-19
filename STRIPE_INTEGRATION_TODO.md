# Stripe and booking integration — website checkout

## Current implementation

- functions/_lib/booking.js validates booking details, recalculates service/add-on prices, checks repeat-customer eligibility, and calculates the final total including tips.
- functions/_lib/customers.js pre-registers customer contact details in D1 without counting an unpaid checkout as a booking. Confirmed bookings increment the customer count.
- functions/api/create-checkout-session.js calculates the discount on the server, accepts a bounded customer-entered tip, and creates separate Stripe line items for each service/add-on and the tip.
- functions/api/booking-status.js verifies the Checkout Session directly with Stripe before the website displays a paid receipt. It can recover a missing D1 booking using verified Stripe metadata.
- functions/api/create-booking.js saves cash bookings with the same server-side loyalty discount.
- functions/api/stripe-webhook.js verifies Stripe signatures and stores the paid amount, pricing breakdown, tip, and selected services in D1.
- index.html displays the optional tip input and shows the loyalty discount and tip in the payment summary.

## Loyalty eligibility

The automatic repeat-customer discount is 10%. The backend matches the normalized customer email/customer_id and requires a previous booking whose booking_json contains jobStatus='completed' and completedAt within the previous 30 days. The timestamp must not be in the future. The discount applies to services and add-ons, not tips. The browser cannot choose a discount or submit a trusted total.

The existing booking_json column stores the pricing breakdown and the job completion markers; this release does not require a D1 schema migration. Existing historical bookings are not automatically marked completed. A trusted staff/manager workflow still needs to write the completion markers only after the job is actually finished.

## Stripe visibility

- Each selected main service/add-on is sent as its own Stripe Checkout line item.
- The optional tip is sent as a separate Customer Tip line item and is not discounted.
- Discounted line item descriptions show the original amount and the loyalty reduction.
- Stripe Checkout Session and PaymentIntent metadata include subtotal, discount percentage/amount, tip, final total, customer and booking details, and selected service breakdown.
- D1 stores the same breakdown in bookings.booking_json for future staff reporting.

## Deployment and testing

1. Confirm the existing BOOKINGS_DB D1 binding and Stripe secrets.
2. No D1 migration is needed for this implementation.
3. Test with Stripe test mode: a customer with a genuinely completed booking within 30 days, a customer without one, and both zero and non-zero tip amounts.
4. Confirm that the Stripe line-item sum equals the final total and that the webhook stores the matching pricing breakdown.
5. Do not infer completed work from a paid payment. The manager/staff completion workflow must record jobStatus='completed' and completedAt after the work is actually finished.

The source code must be deployed to the Cloudflare Pages production project after merging to main. Do not switch to live Stripe keys until end-to-end tests pass.
