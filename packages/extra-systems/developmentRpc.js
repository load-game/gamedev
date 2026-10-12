// Development RPCs are declared by the runtime; scripts can rotate their generation,
// but cannot redirect an engine to another origin or replace a production chain.
export class DevelopmentRpc {
  constructor(chain) {
    if (!chain.development) throw new Error('RPC rotation requires a declared development chain')
    this.chain = chain
    this.origin = new URL(chain.rpcUrls.default.http[0]).origin
    this.current = null
    this.version = 0
  }

  validate(input) {
    const manifest = new URL(input.manifestUrl)
    const rpc = new URL(input.rpcUrl)
    const generation = input.generation
    const deadline = Date.parse(input.resetsAt)
    if (
      manifest.protocol !== 'https:' ||
      rpc.protocol !== 'https:' ||
      manifest.origin !== this.origin ||
      rpc.origin !== this.origin ||
      manifest.username ||
      manifest.password ||
      manifest.search ||
      manifest.hash ||
      rpc.username ||
      rpc.password ||
      rpc.search ||
      rpc.hash ||
      !manifest.pathname.endsWith('/manifest.json') ||
      typeof generation !== 'string' ||
      !/^[A-Za-z0-9-]{1,128}$/.test(generation) ||
      rpc.pathname !== manifest.pathname.slice(0, -'manifest.json'.length) + generation + '/rpc' ||
      input.chainId !== this.chain.id ||
      !Number.isSafeInteger(input.sourceChainId) ||
      input.sourceChainId <= 0 ||
      input.sourceChainId === input.chainId ||
      !Number.isFinite(deadline) ||
      deadline <= Date.now()
    )
      throw new Error('Invalid development RPC generation')
    return Object.freeze({
      chainId: this.chain.id,
      sourceChainId: input.sourceChainId,
      generation,
      rpcUrl: rpc.href,
      manifestUrl: manifest.href,
      resetsAt: input.resetsAt,
      deadline,
    })
  }

  capture() {
    const state = this.current
    if (!state || state.deadline <= Date.now()) throw new Error('Development network is rebuilding')
    return state
  }

  assertCurrent(state) {
    if (this.capture() !== state) throw new Error('Development network generation changed; retry the action')
  }

  async verify(state) {
    const response = await fetch(state.manifestUrl, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error('Development network is rebuilding')
    const manifest = await response.json()
    if (
      manifest.schemaVersion !== 1 ||
      manifest.ready !== true ||
      manifest.phase !== 'ready' ||
      manifest.chainId !== state.chainId ||
      !Number.isSafeInteger(manifest.sourceChainId) ||
      manifest.sourceChainId <= 0 ||
      manifest.sourceChainId === manifest.chainId ||
      manifest.sourceChainId !== state.sourceChainId ||
      manifest.generation !== state.generation ||
      manifest.rpcUrl !== state.rpcUrl ||
      manifest.resetsAt !== state.resetsAt ||
      state.deadline <= Date.now()
    )
      throw new Error('Development network generation changed; retry the action')
  }

  async configure(input) {
    const version = ++this.version
    const candidate = this.validate(input)
    const state =
      this.current?.generation === candidate.generation &&
      this.current.sourceChainId === candidate.sourceChainId &&
      this.current.rpcUrl === candidate.rpcUrl &&
      this.current.manifestUrl === candidate.manifestUrl &&
      this.current.resetsAt === candidate.resetsAt
        ? this.current
        : candidate
    await this.verify(state)
    if (version !== this.version) throw new Error('Development network configuration changed')
    this.current = state
    return state
  }

  async assertFresh(state = this.capture()) {
    this.assertCurrent(state)
    await this.verify(state)
    this.assertCurrent(state)
  }

  pause() {
    this.version++
    this.current = null
  }

  getChain() {
    const state = this.capture()
    return { ...this.chain, rpcUrls: { default: { http: [state.rpcUrl] } } }
  }
}
