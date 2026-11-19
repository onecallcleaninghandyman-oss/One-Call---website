# Stripe and booking integration — current setup

## Server-side architecture

- functions/_lib/booking.js: validates booking details, recalculates service/add-on prices, and calculates repeat-customer discount/tip totals.
- functions/_lib/customers.js: pre-registers customer contact details before checkout without counting an unpaid checkout as a booking; confirmed bookings increment the count separately.
- functions/api/create-checkout-session.js: checks D1 for a completed booking within 30 days, applies a 10% discount server-side, accepts a bounded customer-entered tip, and creates separate Stripe line items for services/add-ons and the tip.
- functions/api/booking-status.js: verifies the Checkout Session directly with Stripe before the website displays a paid receipt and recovers the payment breakdown if needed.
- functions/api/create-booking.js: persists cash bookings in D1 with the same server-side repeat-customer discount.
- functions/api/stripe-webhook.js: verifies Stripe signatures and stores the final paid amount, subtotal, discount, tip and selected service breakdown.
- migrations/0004_repeat_customer_discount_tips.sql: adds job completion fields and payment breakdown columns to the existing bookings table.

## Loyalty eligibility

The automatic repeat-customer discount is 10%. The backend matches the normalized customer email/customer ID and requires a previous booking where job_status='completed', completed_at is within the previous 30 days, and the completion timestamp is not in the future. The discount applies to the service and add-ons, not the tip. The browser cannot choose the discount or submit a trusted total.

Customer contact details are inserted/updated in D1 before Stripe payment so the identity can be matched. This pre-registration does not increment bookings_count. Failed or abandoned payment attempts do not create a booking row.

## Stripe visibility

- Each selected main service/add-on is sent as its own Stripe Checkout line item.
- The customer tip is a separate Customer Tip line item and is not discounted.
- Discounted line item descriptions show the original amount and the 10% loyalty reduction.
- Stripe Checkout Session and PaymentIntent metadata include the subtotal, discount percentage/amount, tip, final total, customer and booking details, and compact selected-service breakdown.
- D1 stores the same breakdown for staff reporting.

## Important deployment requirements

1. Confirm the existing BOOKINGS_DB D1 binding and back up the production database.
2. Apply migrations 0001, 0002, 0003, and 0004 in order if not already applied.
3. Deploy the website code only after the migration is applied to the matching environment.
4. Test in Stripe test mode, including a customer with a genuinely completed booking in the previous 30 days, a customer without such a booking, and tip values of zero and non-zero.
5. Do not infer completed work from a paid payment. A manager-controlled completion workflow still needs to record job_status='completed' and completed_at after the job is actually done.

The code changes in this branch are not live until the branch is deployed. Do not switch to live Stripe keys until end-to-end tests pass.
