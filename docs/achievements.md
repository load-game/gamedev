# Product achievements

Apps provide their own catalog and award rules. The engine provides a generic Account → Achievements panel and authenticated server transport.

Client apps register `world.registerAchievementsClient(request)` to handle `achievements-state` and `achievements-visibility`. The panel displays descriptions, progress, earned dates, optional availability, season labels and per-badge disclosure. `world.openAccount("achievements", {subject})` opens another account's public badges. Account Friends uses this route. App destruction removes its client registration.

Server apps call `world.identity(playerId)`, `world.accountFacts(playerId)` and `world.productRecords(playerId, payload)`. Socket admission supplies the account, and expired or changed sessions reject responses. No browser subject or wallet grants issuer authority. Configure `PRODUCT_RECORDS_GATEWAY_URL` and `PRODUCT_RECORDS_SECRET`, or use the existing private `FRIENDS_GATEWAY_URL` and admission secret. Private room children use an explicit product gateway secret separate from their admission tickets.

Read-only EVM methods `getTransaction`, `getTransactionReceipt` and `getBlockNumber` support server verification on the configured chain. Product code checks the wallet's fresh Identity linkage, trusted deployments, event fields and positive completed values before awarding. These methods do not sign transactions.

Progress storage remains product-owned. Configure a shared PostgreSQL schema and the product's storage prefix when progress must follow accounts between instances. The engine does not interpret achievement rules, season supply, rarity or prices.
