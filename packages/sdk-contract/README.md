# Public SDK contract

`public-api.json` is generated from the canonical `public/openapi.json` document.
It is the language-neutral input for the TypeScript, Python, and Swift SDK
generators. Do not edit it by hand.

Run `npm run sdk:generate` after changing the OpenAPI contract. CI and the SDK
release workflow run `npm run sdk:check` and fail if any generated artifact is
stale or an operation cannot be represented.
