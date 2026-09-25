export function createIdentityAuthBridge(
  baseUrl,
  walletBridge,
  { fetcher = fetch, provider = () => globalThis.ethereum } = {}
) {
  async function request(path, body) {
    const response = await fetcher(`${baseUrl}/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Unable to sign in')
    return data
  }
  return {
    ...walletBridge,
    mode: 'identity',
    enabled: true,
    allowsUnscopedWalletAccess: () => false,
    getSessionUser: () => request('me').catch(() => null),
    async connectWalletSession() {
      const wallet = provider()
      if (!wallet?.request) throw new Error('Open this page in a browser with an EVM wallet installed.')
      const accounts = await wallet.request({ method: 'eth_requestAccounts' })
      const address = accounts?.[0]
      if (!/^0x[0-9a-f]{40}$/i.test(address || '')) throw new Error('Select an EVM wallet account.')
      const chainId = Number(await wallet.request({ method: 'eth_chainId' }))
      const challenge = await request('challenge', { address, chainId })
      const message = `0x${Array.from(new TextEncoder().encode(challenge.message), byte => byte.toString(16).padStart(2, '0')).join('')}`
      const signature = await wallet.request({ method: 'personal_sign', params: [message, address] })
      const current = await wallet.request({ method: 'eth_accounts' })
      if (current?.[0]?.toLowerCase() !== address.toLowerCase()) throw new Error('Wallet changed. Sign in again.')
      await request('verify', { signature })
      return request('me')
    },
    async logoutAndClearSession() {
      await request('logout', {})
      walletBridge.clearRuntimeAuthState?.()
    },
    async updateProfile() {
      throw new Error('Manage your profile in your account settings.')
    },
  }
}
