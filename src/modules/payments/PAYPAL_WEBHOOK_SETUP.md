# PayPal Webhook Setup Guide

This guide explains how to set up and configure PayPal webhooks for automatic payment status updates in the movie ticket booking application.

## Overview

PayPal webhooks allow your application to receive real-time notifications when payment events occur. This eliminates the need for users to return to the app after making a payment, preventing seat booking conflicts during the payment process.

## PayPal Developer Dashboard Setup

1. Go to the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Log in to your account
3. Navigate to "My Apps & Credentials"
4. Select your application or create a new one
5. Scroll down to "Webhooks" section
6. Click "Add Webhook"
7. Enter your webhook URL: `https://your-api-domain.com/payments/paypal/webhook`
8. Select the following event types:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.REFUNDED`
   - `PAYMENT.CAPTURE.REVERSED`
   - `CHECKOUT.ORDER.APPROVED`
   - `CHECKOUT.ORDER.COMPLETED`
9. Click "Save"
10. Once saved, PayPal will generate a Webhook ID - copy this ID

## Application Configuration

1. Open `nestjs-api/src/modules/payments/paypal.service.ts`
2. Replace the placeholder `YOUR_WEBHOOK_ID` with your actual webhook ID from the PayPal Developer Dashboard:

```typescript
private readonly webhookId = 'YOUR_WEBHOOK_ID'; // Replace with your actual webhook ID
```

## Testing Webhooks Locally

To test webhooks during development when your server isn't publicly accessible:

1. Install [ngrok](https://ngrok.com/) to create a secure tunnel to your local server
2. Run your NestJS application locally
3. In a separate terminal, run: `ngrok http 3000` (replace 3000 with your port)
4. Copy the generated HTTPS URL (e.g., `https://a1b2c3d4.ngrok.io`)
5. In the PayPal Developer Dashboard, set the webhook URL to `https://a1b2c3d4.ngrok.io/payments/paypal/webhook`
6. Make a test payment through your application
7. Check server logs for webhook events
8. Verify that payment status is updated correctly

## Webhook Events Handled

The application handles the following PayPal webhook events:

| Event Type                | Description                             | Action                                           |
| ------------------------- | --------------------------------------- | ------------------------------------------------ |
| PAYMENT.CAPTURE.COMPLETED | Payment was successfully captured       | Mark tickets as paid, remove seat reservation    |
| CHECKOUT.ORDER.APPROVED   | Order was approved but not yet captured | No action required                               |
| CHECKOUT.ORDER.COMPLETED  | Entire order was completed              | Process any captures that were part of the order |
| PAYMENT.CAPTURE.DENIED    | Payment was denied                      | Mark payment as failed                           |
| PAYMENT.CAPTURE.REFUNDED  | Payment was refunded                    | Mark payment as refunded (future implementation) |
| PAYMENT.CAPTURE.REVERSED  | Payment was reversed                    | Mark payment as reversed (future implementation) |

## Troubleshooting

- Verify webhook event delivery in the PayPal Developer Dashboard
- Check server logs for webhook receipt and processing
- Ensure the webhookId is correctly configured
- Confirm that your server is publicly accessible or using a proper tunnel for testing
- Verify that payment information is correctly included in the custom_id field

## PayPal Webhook Verification

The application verifies the authenticity of incoming webhooks by:

1. Extracting the raw body content
2. Validating the PayPal signature headers
3. Using the PayPal Webhook Verification API to confirm the message is authentic

If verification fails, the webhook will be rejected.
