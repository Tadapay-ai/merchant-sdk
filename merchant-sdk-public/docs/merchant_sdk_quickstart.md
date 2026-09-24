# 商户 SDK Quickstart

本文档是商户接入 TadaPay 的最短路径。目标是让商户后端创建一次
Agent Checkout，前端展示 `Pay with Agent`，支付完成后通过签名 Webhook
触发履约。

## 1. 前置条件

商户需要从 TadaPay 控制台或注册 API 获取：

- `TADAPAY_API_KEY`：仅允许保存在商户后端；
- `TADAPAY_BASE_URL`：测试或生产 API 地址；
- `TADAPAY_WEBHOOK_SECRET`：创建 Webhook Endpoint 时返回一次。

当前商户测试环境使用单域名：

```sh
TADAPAY_BASE_URL=https://tadapay.ai
```

浏览器不得持有 API Key。浏览器只接收商户后端返回的 Hosted Checkout
URL。

## 2. 安装服务端 SDK

目前 SDK `0.1.0` 尚未发布到 npm/PyPI。拿到
`tadapay-merchant-sdk-0.1.0.zip` 后，先解压，再从其中的
`packages/node/`、`packages/python/`、`packages/browser/` 安装本地包；
纯 HTML 页面可直接参考 `html/index.html` 和同目录的浏览器模块。
在解压后的根目录执行：

```sh
npm install ./packages/node/tadapay-sdk-0.1.0.tgz
python -m pip install ./packages/python/tadapay_sdk-0.1.0-py3-none-any.whl
```

以下注册表安装命令仅在正式公开发布后可用：

Node.js 18+：

```sh
npm install @tadapay/sdk
```

Python 3.11+：

```sh
python -m pip install tadapay-sdk
```

仓库内开发时，可以分别使用本地包：

```sh
npm install ./tadapay/sdks/node
python -m pip install -e ./tadapay/sdks/python
```

## 3. 商户后端创建 Checkout

Node/Express：

```js
import express from "express";
import { TadaPayClient } from "@tadapay/sdk";

const app = express();
app.use(express.json());

const tadapay = new TadaPayClient({
  apiKey: process.env.TADAPAY_API_KEY,
  baseUrl: process.env.TADAPAY_BASE_URL,
});

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

Python/FastAPI：

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

Pass `hostedUrl` to the browser exactly as returned, including its URL
fragment. The fragment carries an expiring, checkout-scoped capability for
the hosted page. Keep the TadaPay API key on the merchant server only.

For x402 USDC on Avalanche, pass the chain-specific token contract in the
payment option. TadaPay fills the `USD Coin`/`2` EIP-712 metadata for Fuji and
Avalanche C-Chain automatically:

```js
payment_options: [{
  rail: "x402",
  scheme: "exact",
  network: "eip155:43113", // use eip155:43114 for Avalanche mainnet
  asset: "0x5425890298aed601595a70AB815c96711a31Bc65", // mainnet: 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E
  pay_to: process.env.AVALANCHE_USDC_TREASURY,
  price: "$0.01",
  decimals: 6,
}],
```

Select the PayAI facilitator on the TadaPay backend with
`TADAPAY_X402_FACILITATOR_PROFILE=payai` and
`TADAPAY_X402_REQUIRE_FACILITATOR=1`. Fuji is for testnet validation; use the
mainnet network/address pair only after production risk and treasury review.

For a merchant-direct StraitsX XSGD route, use the XSGD contract and select the
0xGasless profile. `pay_to` must be the merchant's own Avalanche wallet; the
TadaPay wallet is never used as a settlement recipient:

```js
import { createAvalancheX402PaymentOption } from "@tadapay/sdk";

payment_options: [createAvalancheX402PaymentOption({
  payTo: process.env.MERCHANT_AVALANCHE_TREASURY,
  price: "0.10",
  asset: "XSGD",
  network: "mainnet",
  facilitatorProfile: "0xgasless",
})],
```

The Python SDK exposes the same configuration through
`build_avalanche_x402_payment_option`.

金额使用最小货币单位，例如 USD 29.00 表示为 `2900`。每个订单的
Idempotency Key 必须稳定，重试时不能生成随机值。

## 4. 浏览器展示 `Pay with Agent`

使用交付包时：

```sh
npm install ./packages/browser/tadapay-browser-sdk-0.1.0.tgz
```

正式发布后可改用：

```sh
npm install @tadapay/browser-sdk
```

```js
import { mountPayWithAgentButton } from "@tadapay/browser-sdk";

const response = await fetch("/api/agent-checkout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(order),
});
const checkout = await response.json();

mountPayWithAgentButton({
  element: "#agent-checkout",
  hostedUrl: checkout.hostedUrl,
});
```

无构建工具的页面可参考交付包内的 `html/index.html`，把
`html/tadapay-browser-sdk.js` 与页面部署在同一目录：

```html
<script type="module">
  import { mountPayWithAgentButton } from
    "./tadapay-browser-sdk.js";
</script>
```

正式发布到 npm 后，才可改用固定版本 CDN 地址。

## 5. 验证 Webhook 后履约

必须使用未经 JSON 解析和重新序列化的原始请求体进行验签。

```js
import { constructWebhookEvent } from "@tadapay/sdk";

app.post(
  "/webhooks/tadapay",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const event = constructWebhookEvent({
      payload: req.body,
      signatureHeader: req.get("TadaPay-Signature"),
      secret: process.env.TADAPAY_WEBHOOK_SECRET,
    });

    if (event.type === "agent_payment_intent.succeeded") {
      // 使用 event.intent_id / merchant_order 幂等履约。
    }
    res.sendStatus(204);
  },
);
```

商户应先记录事件，再异步履约。Webhook 重试不能导致重复发放商品或
credits。

## 6. 上线前验证

本地真实 HTTP SDK E2E：

```sh
cd tadapay
python3.11 scripts/sdk_e2e.py
```

针对测试环境：

```sh
TADAPAY_E2E_API_KEY=... \
python3.11 scripts/sdk_e2e.py \
  --base-url https://tadapay.ai
```

SDK 发布物检查：

```sh
python3.11 scripts/sdk_release_audit.py
```

商品注册、发布到 TadaPay Marketplace，以及第三方平台接入边界见
[`merchant_product_registration.md`](merchant_product_registration.md)。

完整生产准入流程见
[`production_readiness.md`](production_readiness.md)。
