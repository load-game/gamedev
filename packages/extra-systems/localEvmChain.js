// Opt-in local chain for self-hosted game development. Absent from ordinary worlds.
export function localEvmChains() {
  const nodeEnv = typeof process !== 'undefined' ? process.env : null
  const rpc = nodeEnv?.LOCAL_EVM_RPC_URL || globalThis.env?.PUBLIC_LOCAL_EVM_RPC_URL
  if (!rpc) return []
  return [{
    id: 31337,
    name: 'Local game development',
    nativeCurrency: { name: 'Test Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  }]
}
