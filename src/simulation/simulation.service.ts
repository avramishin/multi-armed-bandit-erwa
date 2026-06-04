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

const ACTIONS: Action[] = ["BUY", "SELL"];
const TRADE_SIZE_USD = 50;
const LEVERAGE = 10;
const COMMISSION_RATE = 0.0;

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

    const points: SimulationPoint[] = [];

    for (const [index, candle] of candles.entries()) {
      const action = agent.chooseAction();
      const actionToLearn = currentPosition?.action ?? null;
      const closingResult = this.closePositionIfNeeded(
        currentPosition,
        candle.close,
      );
      currentPosition = null;

      totalPnl += closingResult.pnl;
      totalFees += closingResult.fees;
      cumulativePnl += closingResult.pnl;
      balance += closingResult.pnl;

      if (action !== "IDLE" && balance > 0) {
        const nextPosition = this.openPosition(action, candle.close);
        currentPosition = nextPosition.position;
        totalPnl += nextPosition.openingFee;
        totalFees += nextPosition.openingFee;
        cumulativePnl += nextPosition.openingFee;
        balance += nextPosition.openingFee;
      }

      const reward = this.normalizeReward(
        closingResult.pnl + closingResult.fees,
      );
      if (
        actionToLearn &&
        (closingResult.pnl !== 0 || closingResult.fees !== 0)
      ) {
        agent.learn(actionToLearn, reward);
      }

      points.push({
        index,
        timestamp: candle.closeTime,
        close: candle.close,
        action,
        reward,
        stepPnl: closingResult.pnl + closingResult.fees,
        cumulativePnl,
        balance,
        qValues: agent.getMemorySnapshot(),
      });
    }

    if (currentPosition) {
      const finalAction = currentPosition.action;
      const finalCandle = candles[candles.length - 1];
      const finalResult = this.closePositionIfNeeded(
        currentPosition,
        finalCandle.close,
      );
      totalPnl += finalResult.pnl;
      totalFees += finalResult.fees;
      balance += finalResult.pnl;
      cumulativePnl += finalResult.pnl;
      agent.learn(
        finalAction,
        this.normalizeReward(finalResult.pnl + finalResult.fees),
      );

      const lastPoint = points[points.length - 1];
      if (lastPoint) {
        lastPoint.stepPnl += finalResult.pnl + finalResult.fees;
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
  ): {
    position: PositionState;
    openingFee: number;
  } {
    const notionalUsd = TRADE_SIZE_USD * LEVERAGE;
    const quantity = notionalUsd / entryPrice;
    const openingFee = -(notionalUsd * COMMISSION_RATE);

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
  ): {
    pnl: number;
    fees: number;
  } {
    if (!position) {
      return { pnl: 0, fees: 0 };
    }

    const direction = position.action === "BUY" ? 1 : -1;

    const grossPnl =
      (exitPrice - position.entryPrice) * position.quantity * direction;
    const closingFee = -(position.notionalUsd * COMMISSION_RATE);

    return {
      pnl: grossPnl + closingFee,
      fees: closingFee,
    };
  }

  private normalizeReward(value: number): number {
    return Math.tanh(value / TRADE_SIZE_USD);
  }
}
