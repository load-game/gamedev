import 'gamedev'
import type { WorldPlugin } from './index.plugins.d.ts'

export interface EVMRuntimeAPI {
  utils: Record<string, unknown>
  abis: Record<string, unknown>
  getAddress(): string | null
  isConnected(): boolean
  getChainId(params?: { chainId?: number | string | null }): Promise<number>
  readContract(params: any): Promise<any>
  waitForTransactionReceipt(params: any): Promise<any>
  getNativeBalance(address?: string | null): Promise<number>
  getTokenBalance(tokenAddress: string, address?: string | null, decimals?: number): Promise<number>
  getUSDCBalance(address?: string | null): Promise<number>
  sendTransaction?(params: any): Promise<any>
  writeContract?(params: any): Promise<any>
  switchChain?(params?: { chainId?: number | string | null }): Promise<any>
  transferNative?(
    to: string,
    amount: number | string
  ): Promise<{
    hash: string
    receipt: any
  }>
  transferToken?(
    tokenAddress: string,
    to: string,
    amount: number | string,
    decimals?: number
  ): Promise<{
    hash: string
    receipt: any
  }>
  transferUSDC?(
    to: string,
    amount: number | string
  ): Promise<{
    hash: string
    receipt: any
  }>
}

export declare class EVMClient {
  constructor(world: any)
  bind(binding?: {
    walletAdapter?: any
    address?: string | null
    isConnected?: boolean
    chainId?: number | string | null
  }): void
  getRuntimeAPI(chainId?: number | string | null): EVMRuntimeAPI
  getAddress(): string | null
  isConnected(): boolean
}

export declare class EVMServer {
  constructor(world: any)
  getRuntimeAPI(chainId?: number | string | null): EVMRuntimeAPI
  getAddress(): string | null
  isConnected(): boolean
}

export declare const evmScriptApi: {
  world: {
    evm(entity: any, chainId?: number | string | null): EVMRuntimeAPI
  }
  player: {
    evm: {
      get(player: any): string | null
    }
    evmChainId: {
      get(player: any): number | null
    }
  }
}

export declare const evmClientPlugin: WorldPlugin
export declare const evmServerPlugin: WorldPlugin
export declare const evmPlugins: Readonly<{
  client: WorldPlugin
  server: WorldPlugin
}>

declare module 'gamedev' {
  interface Player {
    evm: string | null
    evmChainId: number | null
  }

  interface WorldAPI {
    evm(chainId?: number | string | null): EVMRuntimeAPI
  }
}
