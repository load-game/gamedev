import 'gamedev'
import type { WorldPlugin } from './index.plugins.d.ts'

export interface HyperliquidPosition {
  ticker: string
  size: number
  entryPrice: number
  unrealizedPnl: number
  liquidationPrice: number | null
}

export interface HyperliquidStreamHandle {
  failureSignal: AbortSignal
  unsubscribe(): Promise<void>
}

export type HyperliquidCandleInterval =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '8h'
  | '12h'
  | '1d'
  | '3d'
  | '1w'
  | '1M'

export interface HyperliquidTradesParams {
  ticker: string
}

export interface HyperliquidOrderBookParams {
  ticker: string
  nSigFigs?: number | null
  mantissa?: number | null
}

export interface HyperliquidCandleParams {
  ticker: string
  interval: HyperliquidCandleInterval
}

export interface HyperliquidMidsPayload {
  mids: Record<string, string>
  [key: string]: any
}

export type HyperliquidTradesPayload = any[]

export interface HyperliquidLeverage {
  type: 'cross' | 'isolated'
  value: number
}

export interface HyperliquidLeverageUpdateOptions {
  type?: 'cross' | 'isolated'
}

export interface HyperliquidAccountPosition extends HyperliquidPosition {
  marginUsed: number
  maxLeverage: number
  leverage: HyperliquidLeverage
}

export interface HyperliquidAccountSnapshot {
  address: string
  accountValue: number
  withdrawable: number
  totalMarginUsed: number
  totalNotionalPosition: number
  positions: HyperliquidAccountPosition[]
  timestamp: number
}

export interface HyperliquidWatchOnlyAPI {
  getPrice(ticker: string): Promise<number>
  getBalance(): Promise<number>
  getPositions(): Promise<HyperliquidPosition[]>
  getAvailableTickers(): Promise<string[]>
  getPerpMarkets(options?: any): Promise<any>
  getSpotMarkets(): Promise<any>
  getMarketCatalog(): Promise<any>
  getCandles(params: HyperliquidCandleParams): Promise<any>
  getOrderStatus(params: any): Promise<any>
  getUserFills(params: any): Promise<any>
  getUserFillsByTime(params: any): Promise<any>
  subscribeMids(listener: (payload: HyperliquidMidsPayload) => void): Promise<HyperliquidStreamHandle>
  subscribeTrades(
    params: HyperliquidTradesParams,
    listener: (payload: HyperliquidTradesPayload) => void
  ): Promise<HyperliquidStreamHandle>
  subscribeOrderBook(
    params: HyperliquidOrderBookParams,
    listener: (payload: any) => void
  ): Promise<HyperliquidStreamHandle>
  subscribeCandles(params: HyperliquidCandleParams, listener: (payload: any) => void): Promise<HyperliquidStreamHandle>
  subscribeAccount(listener: (payload: HyperliquidAccountSnapshot) => void): Promise<HyperliquidStreamHandle>
}

export interface HyperliquidAPI extends HyperliquidWatchOnlyAPI {
  buy(ticker: string, amount: number, slippage?: number, options?: any): Promise<any>
  sell(ticker: string, amount: number, slippage?: number, options?: any): Promise<any>
  closePosition(ticker: string, slippage?: number): Promise<any>
  updateLeverage(ticker: string, leverage: number, options?: HyperliquidLeverageUpdateOptions): Promise<any>
  hasAgentKey(): boolean
  setupAgentKey(name?: string): Promise<{ address: string }>
  deposit(amount: number): Promise<{
    status: string
    txHash?: string
    amount?: number
    message?: string
    [key: string]: any
  }>
  withdraw(amount: number, destination?: string): Promise<any>
}

export declare class Hyperliquid {
  constructor(world: any)
  bind(binding?: { address?: string | null; walletAdapter?: any; isConnected?: boolean }): void
  getRuntimeAPI(ownerOrOptions?: any, maybeAddress?: string | null): HyperliquidAPI | HyperliquidWatchOnlyAPI
}

export declare const hyperliquidScriptApi: {
  world: {
    hyperliquid(entity: any, address?: string | null): HyperliquidAPI | HyperliquidWatchOnlyAPI
  }
}

export declare const hyperliquidPlugin: WorldPlugin

declare module 'gamedev' {
  interface WorldAPI {
    hyperliquid(): HyperliquidAPI
    hyperliquid(address: string): HyperliquidWatchOnlyAPI
  }
}
