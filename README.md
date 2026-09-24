# TadaPay Merchant SDK Bundle 0.1.0

This bundle contains the tested merchant SDK release:

- `packages/node/`: server-side `@tadapay/sdk` npm package;
- `packages/python/`: server-side `tadapay-sdk` wheel;
- `packages/browser/`: `@tadapay/browser-sdk` npm package;
- `html/`: no-build browser template and a local browser SDK module;
- `docs/`: checkout, product registration, and Marketplace guides.

The Node and Python SDKs are alternatives for the merchant backend. The HTML
template is frontend-only: it calls the merchant's `/api/agent-checkout`
endpoint and must never contain a TadaPay API key.

For the current merchant test environment, set `TADAPAY_BASE_URL` to
`https://tadapay.ai`. The package is delivered as a local test bundle; it is
not yet published to npm or PyPI.

Install the local packages with `npm install <file>.tgz` or
`python -m pip install <file>.whl`. See `docs/merchant_product_registration.md`
for the catalog lifecycle and the boundary between TadaPay Marketplace and
third-party platform registration.
