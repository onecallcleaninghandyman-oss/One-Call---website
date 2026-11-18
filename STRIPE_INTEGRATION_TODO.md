# Stripe Integration TODO — One Call Cleaning & Handyman Services

## Values to Replace

No sample placeholders remain in the Checkout Session creation call:
- The integration charges one-time payments (`mode=payment`).
- The amount and EUR line item are calculated dynamically on the server from the selected booking. No fixed Stripe Price ID is required.

Before accepting live payments, verify the Cloudflare Pages environment variables:
- `STRIPE_PUBLISHABLE_KEY` — publishable key for the intended Stripe mode.
- `STRIPE_SECRET_KEY` — matching secret key for the same Stripe account and mode (server-side secret).
- `STRIPE_WEBHOOK_SECRET` — signing secret for the webhook endpoint configured for that mode.

## Configured Parameters

**Files containing these parameters:**
- [functions/api/create-checkout-session.js](functions/api/create-checkout-session.js)
- [index.html](index.html)

| Parameter | Value |
|---|---|
| `ui_mode` | `form` |
| `mode` | `payment` |
| `billing_address_collection` | `auto` |
| `phone_number_collection[enabled]` | `false` |
| `automatic_tax[enabled]` | `false` |
| `submit_type` | `pay` |
| `saved_payment_method_options[payment_method_save]` | `enabled` |
| `integration_identifier` | `custom_embedded_web_0002` |
| `line_items` | One dynamically priced EUR line item, quantity 1 |
| Stripe API version | `2026-03-25.dahlia` |
| Stripe.js | `https://js.stripe.com/dahlia/stripe.js` |
| Embedded form theme | `flat` |
| Labels / inputs | `auto` / `spaced` |
| Form layout | `expanded` |
| Appearance | White background `#ffffff`, primary `#0570de`, text `#30313d`, danger `#df1b41`, success `#00c853`, 4px radius, 16px base font, 4px spacing |

`payment_method_collection` is intentionally omitted because this is a one-time payment flow; the Stripe instructions say to include it only for subscriptions. Payment methods are controlled by the active Payment Method configuration in Stripe Dashboard, not overridden in browser code.

## Setup and Next Steps

1. In Cloudflare Pages, confirm `STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY` are set for the same Stripe account and the same mode. Keep the secret key server-side only.
2. Configure `STRIPE_WEBHOOK_SECRET` using the signing secret for the webhook endpoint in that same mode.
3. Confirm the deployed domain is registered in the relevant Stripe mode for wallet methods, where applicable.
4. Test the full booking flow in Stripe test mode first. Verify the server-calculated amount, booking metadata, embedded form appearance, payment confirmation, and return URL.
5. Use Stripe's documented test card `4242 4242 4242 4242`, a future expiry date, any three-digit CVC, and any postal code.
6. Confirm `checkout.session.completed` reaches the webhook and verify the event signature and `payment_status` before treating a booking as paid.
7. After successful test payments, deploy to Cloudflare Pages and perform a small live payment test before accepting customer payments.
8. Confirm successful payments are associated with durable booking records. The current webhook logs completed payment details; it does not yet persist bookings or send customer confirmation notifications.

## Project Structure

- `functions/api/config.js` — returns the publishable key for the deployed environment.
- `functions/api/create-checkout-session.js` — validates booking details, recalculates the total server-side, creates the Embedded Checkout Session, and returns its client secret.
- `functions/api/stripe-webhook.js` — verifies Stripe webhook signatures and handles completed Checkout Sessions.
- `index.html` — booking interface and embedded Checkout Form SDK initialization, appearance, and confirmation handling.

No new server routes or infrastructure were added.

## How the Integration Works

1. The customer selects a service and enters booking details on the website.
2. The browser sends the booking selections to the Cloudflare Pages Function.
3. The server validates the customer details and recalculates the amount; it does not trust a browser-supplied total.
4. The server creates a one-time EUR Embedded Checkout Session using the configured Checkout Studio parameters and returns `client_secret` as JSON.
5. Stripe.js Dahlia initializes the embedded form with the configured appearance and expanded layout.
6. The customer confirms payment in the Stripe-hosted embedded form.
7. The website displays its current success view; production fulfilment must additionally rely on the verified webhook and durable booking storage.

## Resources

- Stripe Support: https://support.stripe.com
- Stripe MCP documentation: https://docs.stripe.com/mcp
- Stripe API keys best practices: https://docs.stripe.com/keys-best-practices
