import { Injectable } from "@nestjs/common";
import { RunSimulationDto } from "./dto/run-simulation.dto";
import { NonStationaryAgent } from "./non-stationary-agent";
import {
  Action,
  Candle,
  PositionState,
  SimulationPoint,
  SimulationSummary,
} from "./simulation.types";
import { BinanceMarketDataService } from "./simulation.market-data.service";
import { SimulationRepository } from "./simulation.repository";

const ACTIONS: Action[] = ["IDLE", "BUY", "SELL"];
@Injectable()
export class SimulationService {
  constructor(
    private readonly marketDataService: BinanceMarketDataService,
    private readonly simulationRepository: SimulationRepository,
  ) {}

  public async runSimulation(
    dto: RunSimulationDto,
  ): Promise<{ id: number; summary: SimulationSummary }> {
    const candles = await this.marketDataService.getCandles(
      dto.symbol,
      dto.candleInterval,
      dto.historySize,
    );

    const summary = this.simulate(dto, candles);
    const id = await this.simulationRepository.create(summary);

    return { id, summary };
  }

  public async listRecentRuns(): Promise<Array<Record<string, unknown>>> {
    return this.simulationRepository.listRecent();
  }

  public async getRun(
    id: number,
  ): Promise<(SimulationSummary & { id: number; createdAt: string }) | null> {
    return this.simulationRepository.getById(id);
  }

  private simulate(
    dto: RunSimulationDto,
    candles: Candle[],
  ): SimulationSummary {
    const agent = new NonStationaryAgent(ACTIONS, {
      learningRate: dto.learningRate,
      epsilon: dto.epsilon,
    });

    let balance = dto.initialDeposit;
    let totalPnl = 0;
    let totalFees = 0;
    let cumulativePnl = 0;
    let currentPosition: PositionState | null = null;
    let previousAction: Action | null = null;
    let previousEntryPrice: number | null = null;

    const points: SimulationPoint[] = [];

    for (const [index, candle] of candles.entries()) {
      const action = agent.chooseAction();
      const actionToLearn = previousAction;
      const entryPriceToLearn = previousEntryPrice;
      const closingResult = this.closePositionIfNeeded(
        currentPosition,
        candle.close,
        dto.commissionPercent,
      );
      currentPosition = null;

      totalPnl += closingResult.netPnl;
      totalFees += closingResult.fees;
      cumulativePnl += closingResult.netPnl;
      balance += closingResult.netPnl;

      if (action !== "IDLE" && balance > 0) {
        const nextPosition = this.openPosition(
          action,
          candle.close,
          dto.tradeSizeUsd,
          dto.leverage,
          dto.commissionPercent,
        );
        currentPosition = nextPosition.position;
        totalPnl += nextPosition.openingFee;
        totalFees += nextPosition.openingFee;
        cumulativePnl += nextPosition.openingFee;
        balance += nextPosition.openingFee;
      }

      let reward = 0;
      if (actionToLearn === "IDLE" && entryPriceToLearn !== null) {
        reward = this.getIdleReward(
          entryPriceToLearn,
          candle.close,
          dto.tradeSizeUsd,
          dto.leverage,
          dto.commissionPercent,
        );
        agent.learn("IDLE", reward);
      } else if (
        actionToLearn &&
        actionToLearn !== "IDLE" &&
        (closingResult.netPnl !== 0 || closingResult.fees !== 0)
      ) {
        reward = this.normalizeReward(closingResult.netPnl, dto.tradeSizeUsd);
        agent.learn(actionToLearn, reward);
      }

      points.push({
        index,
        timestamp: candle.closeTime,
        close: candle.close,
        action,
        reward,
        stepPnl: closingResult.netPnl,
        cumulativePnl,
        balance,
        qValues: agent.getMemorySnapshot(),
      });

      previousAction = action;
      previousEntryPrice = candle.close;
    }

    if (currentPosition && previousAction && previousAction !== "IDLE") {
      const finalCandle = candles[candles.length - 1];
      const finalResult = this.closePositionIfNeeded(
        currentPosition,
        finalCandle.close,
        dto.commissionPercent,
      );
      totalPnl += finalResult.netPnl;
      totalFees += finalResult.fees;
      balance += finalResult.netPnl;
      cumulativePnl += finalResult.netPnl;
      agent.learn(previousAction, this.normalizeReward(finalResult.netPnl, dto.tradeSizeUsd));

      const lastPoint = points[points.length - 1];
      if (lastPoint) {
        lastPoint.stepPnl += finalResult.netPnl;
        lastPoint.cumulativePnl = cumulativePnl;
        lastPoint.balance = balance;
      }
    }

    return {
      symbol: dto.symbol,
      candleInterval: dto.candleInterval,
      historySize: dto.historySize,
      candlesCount: candles.length,
      initialDeposit: dto.initialDeposit,
      tradeSizeUsd: dto.tradeSizeUsd,
      leverage: dto.leverage,
      commissionPercent: dto.commissionPercent,
      finalBalance: Number(balance.toFixed(4)),
      totalPnl: Number(totalPnl.toFixed(4)),
      totalFees: Number(totalFees.toFixed(4)),
      learningRate: dto.learningRate,
      epsilon: dto.epsilon,
      points,
    };
  }

  private openPosition(
    action: Extract<Action, "BUY" | "SELL">,
    entryPrice: number,
    tradeSizeUsd: number,
    leverage: number,
    commissionPercent: number,
  ): {
    position: PositionState;
    openingFee: number;
  } {
    const notionalUsd = tradeSizeUsd * leverage;
    const quantity = notionalUsd / entryPrice;
    const openingFee = -(
      notionalUsd * this.getCommissionRate(commissionPercent)
    );

    return {
      position: {
        action,
        entryPrice,
        notionalUsd,
        quantity,
      },
      openingFee,
    };
  }

  private closePositionIfNeeded(
    position: PositionState | null,
    exitPrice: number,
    commissionPercent: number,
  ): {
    grossPnl: number;
    netPnl: number;
    fees: number;
  } {
    if (!position) {
      return { grossPnl: 0, netPnl: 0, fees: 0 };
    }

    const direction = position.action === "BUY" ? 1 : -1;

    const grossPnl =
      (exitPrice - position.entryPrice) * position.quantity * direction;
    const closingFee = -(
      position.notionalUsd * this.getCommissionRate(commissionPercent)
    );
    const netPnl = grossPnl + closingFee;

    console.log({
      grossPnl,
      netPnl,
      fees: closingFee,
    });

    return {
      grossPnl,
      netPnl,
      fees: closingFee,
    };
  }

  private normalizeReward(value: number, tradeSizeUsd: number): number {
    return Math.tanh(value / Math.max(tradeSizeUsd, 1));
  }

  private getIdleReward(
    entryPrice: number,
    exitPrice: number,
    tradeSizeUsd: number,
    leverage: number,
    commissionPercent: number,
  ): number {
    const notionalUsd = tradeSizeUsd * leverage;
    const quantity = notionalUsd / entryPrice;
    const potentialGrossPnl = Math.abs(exitPrice - entryPrice) * quantity;
    const roundTripFees = 2 * notionalUsd * this.getCommissionRate(commissionPercent);

    return this.normalizeReward(roundTripFees - potentialGrossPnl, tradeSizeUsd);
  }

  private getCommissionRate(commissionPercent: number): number {
    return commissionPercent / 100;
  }
}
