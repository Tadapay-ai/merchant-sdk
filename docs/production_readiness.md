# Go-Live Checklist

Complete the merchant integration checks below before accepting live payments.
Coordinate live-account activation and payment-rail availability with TadaPay.

## Account and settlement

- Complete the business verification and account review requested by TadaPay.
- Confirm your production API base URL and obtain the appropriate live API key.
- Verify the merchant domain used by your public purchase URLs.
- Confirm the enabled payment rails and the settlement destination for each rail.
- Complete any required provider-account or wallet-ownership verification.

Use live credentials and `X-TadaPay-Mode: live` only after live access has been
approved. Keep test credentials and test orders separate from live activity.

## Checkout and fulfillment

- Validate order contents, prices, and customer access on your backend.
- Use stable idempotency keys for retries of the same purchase request.
- Preserve the complete hosted checkout URL, including its fragment.
- Verify webhook signatures against the original request bytes.
- Persist verified events before acknowledging delivery and process fulfillment
  asynchronously with protection against duplicate delivery.
- Confirm that the receipt and merchant order refer to the same purchase.

Complete the test scenarios in the [integration guide](merchant_sdk_quickstart.md)
before switching the integration to live mode.

## Operations

- Configure a reachable HTTPS webhook endpoint and store its signing secret securely.
- Keep API keys, signing secrets, and provider credentials on the backend.
- Prepare monitoring for failed payments, webhook failures, and fulfillment errors.
- Establish procedures for reconciliation, refunds, provider timeouts, and key rotation.
- Confirm the applicable terms of service and privacy disclosures.

For a public Marketplace listing, ensure the merchant account is active and the
product is active and public. See [Merchant Product Registration](merchant_product_registration.md)
for the publishing requirements.
