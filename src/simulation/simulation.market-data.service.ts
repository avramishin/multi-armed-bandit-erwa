import { Injectable } from "@nestjs/common";
import { Candle, CandleInterval } from "./simulation.types";

interface BinanceKlineResponseItem extends Array<number | string> {
  0: number;
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
  6: number;
}

@Injectable()
export class BinanceMarketDataService {
  private readonly cache = new Map<
    string,
    { candles: Candle[]; expiresAt: number }
  >();
  private readonly cacheTtlMs = 60_000;

  public async getCandles(
    symbol: string,
    interval: CandleInterval,
    limit: number,
  ): Promise<Candle[]> {
    const cacheKey = `${symbol}:${interval}:${limit}`;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.candles;
    }

    try {
      const url = new URL("https://fapi.binance.com/fapi/v1/klines");
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("interval", interval);
      url.searchParams.set("limit", String(limit));

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }

      const rows = (await response.json()) as BinanceKlineResponseItem[];

      const candles = rows.map((row) => ({
        openTime: row[0],
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
        closeTime: row[6],
      }));

      this.cache.set(cacheKey, {
        candles,
        expiresAt: Date.now() + this.cacheTtlMs,
      });

      return candles;
    } catch {
      //return this.generateSyntheticCandles(symbol, limit);
      const candles: Candle[] = [];
      this.cache.set(cacheKey, {
        candles,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
      return candles;
    }
  }

  private generateSyntheticCandles(symbol: string, limit: number): Candle[] {
    const seed = this.symbolToSeed(symbol);
    const basePriceBySymbol: Record<string, number> = {
      BTCUSDT: 65000,
      ETHUSDT: 3200,
      SOLUSDT: 145,
    };
    const basePrice = basePriceBySymbol[symbol] ?? 1000;
    const now = Date.now();
    let lastClose = basePrice;

    return Array.from({ length: limit }, (_, index) => {
      const noise =
        Math.sin((index + seed) / 7) * 0.012 +
        Math.cos((index + seed) / 19) * 0.008;
      const drift = Math.sin((index + seed) / 37) * 0.004;
      const open = lastClose;
      const close = Math.max(0.0001, open * (1 + noise + drift));
      const high = Math.max(open, close) * (1 + 0.0035);
      const low = Math.min(open, close) * (1 - 0.0035);
      const volume = 100 + ((index + seed) % 30) * 4;
      const closeTime = now - (limit - index) * 5 * 60_000;
      const candle: Candle = {
        openTime: closeTime - 5 * 60_000,
        open,
        high,
        low,
        close,
        volume,
        closeTime,
      };

      lastClose = close;
      return candle;
    });
  }

  private symbolToSeed(symbol: string): number {
    return symbol
      .split("")
      .reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0);
  }
}
