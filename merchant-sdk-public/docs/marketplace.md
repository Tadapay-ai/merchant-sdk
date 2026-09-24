# Agent Marketplace

TadaPay's catalog API is merchant-scoped. The marketplace adds a public,
cross-merchant discovery and purchase surface for products that are both
`active` and `public` from an `active` merchant. A newly self-registered
merchant remains `pending_review` until Ops approves it, so its products do
not appear in Marketplace search yet.

## Discovery

```http
GET /agent/marketplace/products?q=research&item_type=digital_good&limit=50
X-TadaPay-Mode: test
```

The response is a list of `AgentCatalogManifest` objects. Each manifest includes
the verified merchant identity, product details, active offers, fulfillment
metadata, and a `marketplace_purchase` action. Unlisted products are not
included in marketplace results.

An individual product can be fetched with:

```http
GET /agent/marketplace/products/{merchant_id}/{product_slug}
```

Publishing here does not submit a product to a third-party agent directory or
storefront. Such a platform must integrate this API or the Marketplace MCP and
complete any platform-specific registration separately.

## Purchase

The agent selects an exact one-time `price.id` from the manifest and submits a
bounded request:

```http
POST /agent/marketplace/checkouts
Idempotency-Key: marketplace:order-123
Content-Type: application/json
X-TadaPay-Mode: test

{
  "merchant_id": "m_demo",
  "product_slug": "agent-research-pack",
  "price_id": "price_...",
  "quantity": 1,
  "merchant_order": { "id": "order-123" },
  "payment_options": [{ "rail": "sandbox", "mode": "test" }]
}
```

The gateway resolves the public product and price server-side, rejects stale or
recurring offers, and creates the same immutable checkout snapshot used by
merchant-created checkouts. The response contains `intent.agent_capability_token`.
The agent sends that token as `X-TadaPay-Agent-Capability` when calling the
returned request's `select_rail`, `confirm`, and `receipt` actions. Production
deployments should require this capability and enforce wallet/provider policy at
the external signer.

The Marketplace MCP is the primary Agent interface. The companion CLI is useful
for shell scripts, CI, and runtimes without MCP. Wallet installation and signing
are delegated to a provider/MCP; see the packaged
`marketplace-mcp/skill/SKILL.md` for the agent workflow.

The stdio MCP package is `@tadapay/marketplace-mcp` and exposes
`tadapay_marketplace_search`, `tadapay_marketplace_get_product`,
`tadapay_marketplace_create_checkout`, `tadapay_marketplace_select_rail`,
`tadapay_marketplace_get_request`, `tadapay_marketplace_prepare_x402`,
`tadapay_marketplace_confirm_checkout`, and
`tadapay_marketplace_get_receipt`. Confirmation requires an explicit
`authorized: true` argument; signing remains in the separate Wallet MCP.

TadaPay also does not host the digital asset itself. After a successful receipt,
the merchant's configured fulfillment/webhook integration delivers the file,
license, API entitlement, or service access represented by the product.
