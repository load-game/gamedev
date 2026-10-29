# Development chain metadata

Self-hosted worlds opt into an EVM chain with `LOCAL_EVM_RPC_URL` and
`LOCAL_EVM_CHAIN_ID`. Supply the corresponding `PUBLIC_` variables to the
browser. No additional chain is registered when the RPC setting is absent.

The native currency defaults to Test Ether, ETH and 18 decimals. Override
that metadata when the development network uses another gas token:

```dotenv
LOCAL_EVM_NATIVE_CURRENCY_NAME=HYPE
LOCAL_EVM_NATIVE_CURRENCY_SYMBOL=HYPE
LOCAL_EVM_NATIVE_CURRENCY_DECIMALS=18
PUBLIC_LOCAL_EVM_NATIVE_CURRENCY_NAME=HYPE
PUBLIC_LOCAL_EVM_NATIVE_CURRENCY_SYMBOL=HYPE
PUBLIC_LOCAL_EVM_NATIVE_CURRENCY_DECIMALS=18
```

The server settings take precedence when both environments are available.
Currency names must contain text and fit within 64 characters; symbols use
1 to 16 ASCII letters or digits; decimals must be an integer from 0 to 36.
Malformed metadata is rejected before constructing a wallet network request.
The metadata does not change balances, gas pricing or the RPC's chain ID.

Run `pnpm exec vp test run test/integration/custom-chain.test.js` to check
server/browser agreement, existing defaults and wallet network registration.
