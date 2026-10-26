# Dependency security updates

The October 26, 2026 update upgrades the runtime HTTP libraries, request parsers,
WebSocket libraries, wallet transitive dependencies, and Vite+ tooling to releases
containing the known security fixes. Vite+ and its `vite` alias must have the same
version; generated projects use the same pair. Package overrides keep transitive
copies on patched releases, including the separate WebSocket 7 and 8 branches.

## Legacy Zod

Wallet SDKs still require the Zod 3 API. The graph consolidates those dependencies
on Zod 3.25.76 and applies `patches/zod@3.25.76.patch` through pnpm. The patch moves
rejection of arrays and sets exceeding declared upper bounds ahead of element
validation, including asynchronous validation. It preserves valid-input parsing
and nested error paths. The corresponding upstream fix is
https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd.

The backport covers Zod 3's CommonJS, ESM, and TypeScript source entry points.
Four regression tests exercise the dependency actually resolved by the wallet
SDK. Current Zod 4 dependencies use the patched upstream release instead.

Ordinary `pnpm audit` still reports the version-only legacy Zod advisory. CI does
not suppress it globally. `pnpm run audit:security` permits only that advisory on
3.25.76 with the reviewed patch checksum and rejects other high or critical
findings. Its regression tests run before the audit gate. Remove this backport
when the wallet dependencies support a patched upstream API.

## Legacy URI decoding

WalletConnect's query-string dependency still requires the CommonJS decoder
API. The published fixed decoder uses ESM. The managed patch for
`decode-uri-component@0.2.2` uses the linear decoding algorithm from upstream
0.5.1 while retaining CommonJS and the old plus-to-space behavior. Its upstream
package archive has SHA-256
`68747a955bbb6a700d758155cf5ff15595c0dfa38504d385abdb249c688bfb15`.
The existing MIT license remains in the dependency package.

Regression tests load the real wallet dependency and check normal decoding,
malformed UTF-8, and long malformed input in a process with a two-second timeout
and a 64 MB JavaScript heap. The ordinary audit retains the version-only moderate
finding; the runtime code has the backported algorithm. No global audit
suppression is configured.
