# TadaPay Merchant SDK Integration Guide

SDK version: `0.1.0`

This guide covers the merchant integration from checkout creation to fulfillment.
Your backend creates an Agent Checkout, your frontend displays `Pay with Agent`,
and your backend verifies a signed webhook before delivering the purchase.

## 1. Prerequisites

Obtain the following values through the TadaPay merchant console or registration API:

| Variable | Purpose |
| --- | --- |
| `TADAPAY_API_KEY` | Merchant API key. Store it on your backend only. |
| `TADAPAY_BASE_URL` | API base URL for your assigned environment. |
| `TADAPAY_WEBHOOK_SECRET` | Signing secret returned once when a webhook endpoint is created. |

The test environment documented in the delivered bundle uses:

```sh
TADAPAY_BASE_URL=https://tadapay.ai
```

Register at `https://tadapay.ai/console/register`, complete email verification,
and save the one-time test API key. For the registration API and product setup,
see [Merchant Product Registration](merchant_product_registration.md).

The browser must never receive your API key. It receives only the hosted checkout
URL returned by your backend. Configure the environment variables before starting
your merchant application.

## 2. Install the SDK

Extract the SDK bundle. Run the installation
command from the extracted bundle's root, or replace the relative path with the
absolute path to the package file.

Choose one server SDK for your backend.

### Node.js 18 or later

```sh
npm install ./packages/node/tadapay-sdk-0.1.0.tgz
```

The Express example below also requires:

```sh
npm install express
```

Use an ES module application, such as an `.mjs` entry point or a project with
`"type": "module"` in `package.json`.

### Python 3.11 or later

```sh
python -m pip install ./packages/python/tadapay_sdk-0.1.0-py3-none-any.whl
```

The FastAPI example below also requires:

```sh
python -m pip install fastapi uvicorn
```

### Browser package

For an application with a frontend bundler:

```sh
npm install ./packages/browser/tadapay-browser-sdk-0.1.0.tgz
```

For a plain HTML page, use `html/index.html` and the adjacent
`html/tadapay-browser-sdk.js` module from the bundle.

Use the supplied package files for this release.

## 3. Create a checkout on your backend

The examples accept an order with this structure:

```json
{
  "id": "order_123",
  "total": 2900,
  "items": [
    {
      "id": "credits",
      "name": "1,000 API credits",
      "quantity": 1,
      "unit_amount": 2900,
      "currency": "USD",
      "item_type": "digital_good"
    }
  ]
}
```

Amounts use minor currency units: USD 29.00 is `2900`. In your application,
authenticate the buyer and load or validate the order, prices, and line items
against trusted merchant data before passing them to the SDK. The example's
request body illustrates the payload shape.

Use stable idempotency keys for each order. Retries of the same request must
reuse the same key and payload rather than generating a random key. The intent
and checkout session use separate keys.

### Node.js with Express

```js
import express from "express";
import { TadaPayClient } from "@tadapay/sdk";

const app = express();

const tadapay = new TadaPayClient({
  apiKey: process.env.TADAPAY_API_KEY,
  baseUrl: process.env.TADAPAY_BASE_URL,
});

app.use("/api", express.json());

app.post("/api/agent-checkout", async (req, res, next) => {
  try {
    const order = req.body;
    const checkout = await tadapay.createAgentCheckout(
      {
        merchant_order: { id: order.id },
        commerce_type: "digital_service",
        amount: {
          currency: "USD",
          subtotal: order.total,
          tax: 0,
          shipping: 0,
          discount: 0,
          total: order.total,
        },
        line_items: order.items,
        fulfillment: {
          type: "api_credits",
          delivery_mode: "instant",
        },
        payment_options: [{ rail: "sandbox", mode: "test" }],
      },
      {
        idempotencyKey: `${order.id}:agent-intent:v1`,
        sessionIdempotencyKey: `${order.id}:agent-session:v1`,
      },
    );

    res.json({
      hostedUrl: checkout.hostedUrl,
      checkoutSessionId: checkout.checkoutSession.id,
    });
  } catch (error) {
    next(error);
  }
});
```

JSON parsing is scoped to `/api` so that the webhook route in section 5 can
receive the original request body. If you use a global `express.json()` parser,
register the raw-body webhook route before that parser.

### Python with FastAPI

```python
import os

from fastapi import FastAPI
from tadapay_sdk import TadaPayClient

app = FastAPI()
tadapay = TadaPayClient(
    api_key=os.environ["TADAPAY_API_KEY"],
    base_url=os.environ["TADAPAY_BASE_URL"],
)


@app.post("/api/agent-checkout")
def create_agent_checkout(order: dict):
    checkout = tadapay.create_agent_checkout(
        {
            "merchant_order": {"id": order["id"]},
            "commerce_type": "digital_service",
            "amount": {
                "currency": "USD",
                "subtotal": order["total"],
                "tax": 0,
                "shipping": 0,
                "discount": 0,
                "total": order["total"],
            },
            "line_items": order["items"],
            "fulfillment": {
                "type": "api_credits",
                "delivery_mode": "instant",
            },
            "payment_options": [{"rail": "sandbox", "mode": "test"}],
        },
        idempotency_key=f"{order['id']}:agent-intent:v1",
        session_idempotency_key=f"{order['id']}:agent-session:v1",
    )
    return {
        "hostedUrl": checkout["hosted_url"],
        "checkoutSessionId": checkout["checkout_session"]["id"],
    }
```

Pass `hostedUrl` to the browser exactly as returned, including its URL fragment.
The fragment carries an expiring capability scoped to the checkout. Keep the
TadaPay API key on the merchant server.

### Optional: x402 USDC on Avalanche

Replace the sandbox payment option with a chain-specific x402 option when the
TadaPay backend and merchant have been configured for that rail. For Fuji:

```js
const paymentOptions = [{
  rail: "x402",
  scheme: "exact",
  network: "eip155:43113",
  asset: "0x5425890298aed601595a70AB815c96711a31Bc65",
  pay_to: process.env.AVALANCHE_USDC_TREASURY,
  price: "$0.01",
  decimals: 6,
}];
```

Use `paymentOptions` as the checkout payload's `payment_options`. TadaPay fills
the `USD Coin` / `2` EIP-712 metadata for Fuji and Avalanche C-Chain automatically.

| Environment | Network | USDC contract |
| --- | --- | --- |
| Fuji testnet | `eip155:43113` | `0x5425890298aed601595a70AB815c96711a31Bc65` |
| Avalanche mainnet | `eip155:43114` | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` |

Ask TadaPay to confirm that the PayAI route is enabled for your environment.
Fuji is for testnet validation. Use the mainnet network and contract together
only after live access and the merchant settlement wallet have been approved.

### Optional: merchant-direct XSGD on Avalanche

For a StraitsX XSGD route, use the XSGD asset and the `0xgasless` profile.
The settlement recipient must be the merchant's own Avalanche wallet:

```js
import { createAvalancheX402PaymentOption } from "@tadapay/sdk";

const paymentOptions = [createAvalancheX402PaymentOption({
  payTo: process.env.MERCHANT_AVALANCHE_TREASURY,
  price: "0.10",
  asset: "XSGD",
  network: "mainnet",
  facilitatorProfile: "0xgasless",
})];
```

Use this value as the checkout payload's `payment_options`. The Python SDK
provides the equivalent `build_avalanche_x402_payment_option` helper. The
TadaPay wallet is not the settlement recipient for this merchant-direct route.

## 4. Display Pay with Agent in the browser

Add a mount point to your page:

```html
<div id="agent-checkout"></div>
```

With the browser package installed, call your merchant backend and mount the button:

```js
import { mountPayWithAgentButton } from "@tadapay/browser-sdk";

const response = await fetch("/api/agent-checkout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(order),
});
if (!response.ok) throw new Error("Unable to create Agent Checkout");
const checkout = await response.json();

mountPayWithAgentButton({
  element: "#agent-checkout",
  hostedUrl: checkout.hostedUrl,
});
```

Here, `order` is your application's order data, using the structure in section 3.
Your backend remains responsible for validating it.

For a page without a build step, deploy `html/tadapay-browser-sdk.js` beside
the HTML page and use a module import:

```html
<script type="module">
  import { mountPayWithAgentButton } from "./tadapay-browser-sdk.js";
</script>
```

The bundle's `html/index.html` includes a complete browser example. Use the
supplied browser module for a page without a build step.

## 5. Verify the webhook before fulfillment

Use the original request bytes for signature verification. Do not parse and
re-serialize the body before verification.

Add the following route to the Express application in section 3. Supply
`persistEventAndEnqueueFulfillment` through your own storage and job system.
That application function must durably save the verified event, deduplicate it
by `event.id`, and enqueue fulfillment for `event.data.merchant_order_id`.
Repeated deliveries must resolve successfully without creating duplicate jobs.

```js
import { constructWebhookEvent } from "@tadapay/sdk";

function registerTadaPayWebhook(app, persistEventAndEnqueueFulfillment) {
  app.post(
    "/webhooks/tadapay",
    express.raw({ type: "application/json" }),
    async (req, res, next) => {
      let event;
      try {
        event = constructWebhookEvent({
          payload: req.body,
          signatureHeader: req.get("TadaPay-Signature"),
          secret: process.env.TADAPAY_WEBHOOK_SECRET,
        });
      } catch {
        return res.sendStatus(400);
      }

      try {
        if (event.type === "receipt.issued") {
          await persistEventAndEnqueueFulfillment(event);
        }
        return res.sendStatus(204);
      } catch (error) {
        return next(error);
      }
    },
  );
}
```

Call `registerTadaPayWebhook(app, yourPersistenceFunction)` during application
startup. Keep the route outside JSON-parsing middleware.

Successful receipt notifications use this envelope:

```json
{
  "id": "wd_123",
  "type": "receipt.issued",
  "created_at": "2026-06-23T00:00:00Z",
  "data": {
    "intent_id": "api_123",
    "request_id": "pr_123",
    "receipt_id": "rcpt_123",
    "merchant_order_id": "order_123",
    "request_hash": "sha256:..."
  }
}
```

Persist the event before acknowledging delivery, then fulfill asynchronously.
Also enforce order-level idempotency so multiple notifications cannot deliver
the same product or credits twice. Your webhook integration delivers the file,
license, API credits, or service access; TadaPay does not host the digital asset.

## 6. Validate the integration

Complete these checks in your assigned test environment:

1. Create a checkout for a known test order and confirm that the returned URL opens.
2. Retry the same order with the same idempotency keys and payload; confirm that
   the request reuses the existing intent and checkout session.
3. Open checkout through the `Pay with Agent` button and complete the test payment.
4. Confirm that your webhook receives and verifies the signed `receipt.issued` event.
5. Confirm that an invalid webhook signature is rejected.
6. Replay a valid webhook and confirm that fulfillment occurs only once.
7. Check that the order ID in the receipt matches the order fulfilled by your system.

See [Merchant Product Registration](merchant_product_registration.md) for
catalog synchronization and publication, [Agent Marketplace](marketplace.md)
for agent discovery and purchases, and the [Go-Live Checklist](production_readiness.md)
for the steps required before accepting live payments.
