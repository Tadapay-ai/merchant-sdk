# Merchant Product Registration

This guide covers the merchant-side catalog lifecycle and the distinction
between publishing to TadaPay Marketplace and registering on a third-party
platform.

## 1. Get a merchant API key

Start a registration, verify the owner email, and keep the returned API key on
the merchant server only:

```http
POST /v1/auth/registrations
Content-Type: application/json

{
  "display_name": "Acme APIs",
  "domain": "acme.example",
  "country": "US",
  "owner_email": "founder@acme.example",
  "owner_name": "Ada Founder"
}
```

Then call `/v1/auth/registrations/{merchant_id}/verify` with the email code.
The response contains a one-time `tadapay_sk_test_...` key for the test mode.
Use `X-TadaPay-Mode: live` and a live key only after the merchant passes the
production review gates.

For the current test environment, open
`https://tadapay.ai/console/register` and follow the on-screen verification
steps. Save the one-time test API key when the registration completes; it is not
shown again.

The merchant console also has a Products page for manual entry. The SDK/API
path below is for integrating an existing store or automating catalog sync.

## 2. Register or synchronize a product

The recommended endpoint is an idempotent upsert. It keeps the merchant's own
product ID stable and can create or update variants and prices in one request.
Every write needs an `Idempotency-Key`.

```js
let detail = await tadapay.upsertCatalogProduct(
  "api-credits-1000",
  {
    name: "1,000 API credits",
    description: "Instantly delivered API credits.",
    item_type: "digital_good",
    status: "draft",
    visibility: "private",
    public_slug: "api-credits-1000",
    purchase_url: "https://acme.example/agent/api-credits-1000",
    fulfillment_type: "digital_delivery",
    delivery_mode: "instant",
    source: "sdk",
    variants: [{
      external_variant_id: "default",
      name: "Default",
      prices: [{ unit_amount: 2900, price_type: "one_time" }],
    }],
  },
  { idempotencyKey: "catalog:api-credits-1000:v1", mode: "test" },
);
```

The Python SDK exposes the same API:

```python
detail = tadapay.upsert_catalog_product(
    "api-credits-1000",
    {
        "name": "1,000 API credits",
        "description": "Instantly delivered API credits.",
        "item_type": "digital_good",
        "status": "draft",
        "visibility": "private",
        "public_slug": "api-credits-1000",
        "purchase_url": "https://acme.example/agent/api-credits-1000",
        "fulfillment_type": "digital_delivery",
        "delivery_mode": "instant",
        "source": "sdk",
        "variants": [{
            "external_variant_id": "default",
            "name": "Default",
            "prices": [{"unit_amount": 2900, "price_type": "one_time"}],
        }],
    },
    idempotency_key="catalog:api-credits-1000:v1",
    mode="test",
)
```

Amounts are USD minor units (`2900` means USD 29.00). A subscription product
must use a recurring price; Marketplace checkout currently accepts one-time
offers only.

The lower-level alternatives are `POST /v1/catalog/products`,
`POST /v1/catalog/variants`, and `POST /v1/catalog/prices` when the merchant
needs separate writes.

## 3. Activate and publish

The upsert response includes `detail.product.id` and its optimistic-lock
`version`. Move the product through the state machine using the current version:

```js
detail = await tadapay.activateCatalogProduct(
  detail.product.id,
  detail.product.version,
  { idempotencyKey: "catalog:api-credits-1000:activate:v1", mode: "test" },
);

detail = await tadapay.publishCatalogProduct(
  detail.product.id,
  detail.product.version,
  "public",
  { idempotencyKey: "catalog:api-credits-1000:publish:v1", mode: "test" },
);
```

Use `"unlisted"` instead of `"public"` for a direct, non-searchable product.

Publishing requires the `catalog:publish` permission (owner/admin by default).
For a public listing, the product must have:

- a description and URL-safe `public_slug`;
- an HTTPS `purchase_url` on a verified merchant domain;
- at least one active variant and active price.

Create and complete a domain verification with
`POST /v1/domain_verifications` before publishing a purchase URL on that
domain in production. Development/test mode also accepts the merchant's
registered domain without a separate verification record. If a product is only
used by the merchant's own checkout, keep it
`private` and call `createCatalogCheckout` with the returned price ID.

## 4. What “external platform registration” means

`publishCatalogProduct(..., "public")` publishes to TadaPay's own public,
cross-merchant Marketplace. It does not register the product in ChatGPT,
OpenClaw, another agent directory, or a third-party marketplace.

The merchant account must also be `active`; the self-serve registration starts
at `pending_review`, so Ops approval is needed before the product appears in
TadaPay Marketplace, including in test mode. Once the merchant is active and
the product is active and public, it is discoverable without a merchant API key:

```http
GET /agent/marketplace/products?q=api+credits&item_type=digital_good
```

An agent or external platform can consume this REST API or integrate the
separately distributed TadaPay Marketplace MCP or CLI. Those agent-side packages
are not part of the merchant SDK bundle. The platform must complete any required
MCP, plugin, or app registration through its own registration process.

For a purchase, the agent selects an active one-time `price_id` from the public
manifest and posts `merchant_id`, `product_slug`, `price_id`, `quantity`, an
order ID, and payment options to `/agent/marketplace/checkouts`. It then uses
the returned capability token to select and confirm a rail and read the receipt.
The merchant's webhook/fulfillment integration delivers the file, license,
credits, or service access after successful payment; TadaPay does not host the
digital asset.
