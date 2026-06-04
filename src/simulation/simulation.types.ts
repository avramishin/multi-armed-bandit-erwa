export type Action = 'IDLE' | 'BUY' | 'SELL';
export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface SimulationPoint {
  index: number;
  timestamp: number;
  close: number;
  action: Action;
  reward: number;
  stepPnl: number;
  cumulativePnl: number;
  balance: number;
  qValues: Record<Action, number>;
}

export interface SimulationSummary {
  symbol: string;
  candleInterval: CandleInterval;
  historySize: number;
  candlesCount: number;
  initialDeposit: number;
  finalBalance: number;
  totalPnl: number;
  totalFees: number;
  learningRate: number;
  epsilon: number;
  points: SimulationPoint[];
}

export interface PositionState {
  action: Extract<Action, 'BUY' | 'SELL'>;
  entryPrice: number;
  notionalUsd: number;
  quantity: number;
}
