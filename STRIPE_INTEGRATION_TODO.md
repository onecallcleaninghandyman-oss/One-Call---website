# Stripe Integration TODO

## Values to Replace

No sample placeholders remain in the existing Checkout Session creation call:
- The payment mode is set to one-time payment.
- The line item is generated dynamically on the server from the booking details and calculated EUR amount; it does not use a placeholder Price ID.

## Configured Parameters

**Files containing these parameters:**
- [functions/api/create-checkout-session.js](functions/api/create-checkout-session.js)
- [index.html](index.html)

| Parameter | Value |
|---|---|
| mode | payment |
| ui_mode | form |
| billing_address_collection | auto |
| phone_number_collection[enabled] | false |
| automatic_tax[enabled] | false |
| submit_type | pay |
| integration_identifier | custom_embedded_web_0002 |
| line_items | One dynamically priced EUR line item, quantity 1 |
| Stripe.js | https://js.stripe.com/dahlia/stripe.js |
| Embedded form appearance theme | flat |

The existing server-side booking price calculation, customer/booking metadata, return URL, and JSON client-secret response have been preserved. `payment_method_collection` is not set because this is a one-time payment integration.

## Payment methods

The embedded Checkout form does not override individual payment methods in the browser. Stripe uses the active payment-method configuration in the Stripe Dashboard. The currently verified LIVE Default configuration has these methods enabled:
- Card (Visa / Mastercard; Apple Pay and Google Pay appear where supported)
- Amazon Pay
- Apple Pay
- Google Pay
- Link
- Klarna
- Revolut Pay

Keep this list managed in Stripe Dashboard. Do not add client-side `expressCheckout.paymentMethods` overrides that hide methods enabled in the account.

## Setup and Next Steps

1. In Cloudflare Pages, confirm that `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` are configured as environment variables for the correct environment (Preview and Production as applicable). Keep the secret key server-side only.
2. Confirm that the publishable key returned by the existing `/api/config` endpoint belongs to the same Stripe account and mode as the secret key.
3. Test the booking flow in Stripe test mode first. Verify the displayed amount, booking details, payment confirmation, and return URL. Use Stripe's documented test card `4242 4242 4242 4242`, a future expiry date, and any three-digit CVC.
4. Saving payment methods is disabled in the server request. Do not enable `saved_payment_method_options` unless a Stripe Customer is attached to the Checkout Session.
5. Configure a Stripe webhook endpoint before relying on automatic booking fulfilment. At minimum, handle `checkout.session.completed`; verify the webhook signature and check `payment_status` before marking a booking as paid. Handle delayed payment success events if you later enable payment methods that can complete asynchronously.
6. Confirm that a successful payment is recorded against a durable booking record. The current browser success screen is not a substitute for a verified webhook or server-side payment record.
7. After successful test payments, deploy the changes to Cloudflare Pages and perform a small live payment test before accepting customer payments.

## How the Integration Works

1. The customer selects a service and booking details on the website.
2. The Cloudflare Pages Function recalculates the total on the server; it does not trust a total supplied by the browser.
3. The function creates a one-time Embedded Checkout Session and returns its `client_secret` as JSON.
4. Stripe.js initializes the embedded form in the payment modal.
5. The customer confirms payment in the embedded form. The site displays its current success receipt after Stripe confirmation; production fulfilment should additionally be driven by a verified webhook.

## Project Structure

- `functions/api/create-checkout-session.js` — existing server endpoint that calculates the booking total and creates the Checkout Session.
- `index.html` — existing booking interface and Embedded Checkout form.
- No new server routes or files were added for the integration.
