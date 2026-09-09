// Opt-in local chain for self-hosted game development. Absent from ordinary worlds.
export function localEvmChains(
  nodeEnv = typeof process !== 'undefined' ? process.env : null,
  publicEnv = globalThis.env
) {
  const rpc = nodeEnv?.LOCAL_EVM_RPC_URL || publicEnv?.PUBLIC_LOCAL_EVM_RPC_URL
  if (!rpc) return []
  const id = Number(nodeEnv?.LOCAL_EVM_CHAIN_ID || publicEnv?.PUBLIC_LOCAL_EVM_CHAIN_ID || 31337)
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid LOCAL_EVM_CHAIN_ID')
  const url = new URL(rpc)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid LOCAL_EVM_RPC_URL')
  return [
    {
      id,
      name: nodeEnv?.LOCAL_EVM_CHAIN_NAME || publicEnv?.PUBLIC_LOCAL_EVM_CHAIN_NAME || 'Local game development',
      nativeCurrency: { name: 'Test Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [rpc] } },
    },
  ]
}
