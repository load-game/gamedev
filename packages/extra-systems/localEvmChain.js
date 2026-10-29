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
  const nativeCurrency = {
    name: nodeEnv?.LOCAL_EVM_NATIVE_CURRENCY_NAME || publicEnv?.PUBLIC_LOCAL_EVM_NATIVE_CURRENCY_NAME || 'Test Ether',
    symbol: nodeEnv?.LOCAL_EVM_NATIVE_CURRENCY_SYMBOL || publicEnv?.PUBLIC_LOCAL_EVM_NATIVE_CURRENCY_SYMBOL || 'ETH',
    decimals: Number(
      nodeEnv?.LOCAL_EVM_NATIVE_CURRENCY_DECIMALS ?? publicEnv?.PUBLIC_LOCAL_EVM_NATIVE_CURRENCY_DECIMALS ?? 18
    ),
  }
  if (
    typeof nativeCurrency.name !== 'string' ||
    !nativeCurrency.name.trim() ||
    nativeCurrency.name.length > 64 ||
    typeof nativeCurrency.symbol !== 'string' ||
    !/^[A-Za-z0-9]{1,16}$/.test(nativeCurrency.symbol) ||
    !Number.isInteger(nativeCurrency.decimals) ||
    nativeCurrency.decimals < 0 ||
    nativeCurrency.decimals > 36
  )
    throw new Error('Invalid LOCAL_EVM_NATIVE_CURRENCY configuration')
  return [
    {
      id,
      development: true,
      name: nodeEnv?.LOCAL_EVM_CHAIN_NAME || publicEnv?.PUBLIC_LOCAL_EVM_CHAIN_NAME || 'Local game development',
      nativeCurrency,
      rpcUrls: { default: { http: [rpc] } },
    },
  ]
}
