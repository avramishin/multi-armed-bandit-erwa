import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SimulationSummary } from './simulation.types';

interface SimulationRunRow {
  id: number;
  symbol: string;
  history_size: number;
  initial_deposit: number;
  learning_rate: number;
  epsilon: number;
  candles_count: number;
  final_balance: number;
  total_pnl: number;
  total_fees: number;
  result_json: string;
  created_at: string;
}

@Injectable()
export class SimulationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  public async create(summary: SimulationSummary): Promise<number> {
    const [id] = await this.databaseService.connection('simulation_runs').insert({
      symbol: summary.symbol,
      history_size: summary.historySize,
      initial_deposit: summary.initialDeposit,
      learning_rate: summary.learningRate,
      epsilon: summary.epsilon,
      candles_count: summary.candlesCount,
      final_balance: summary.finalBalance,
      total_pnl: summary.totalPnl,
      total_fees: summary.totalFees,
      result_json: JSON.stringify(summary),
    });

    return Number(id);
  }

  public async listRecent(limit = 10): Promise<Array<Record<string, unknown>>> {
    const rows = await this.databaseService.connection<SimulationRunRow>('simulation_runs')
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      historySize: row.history_size,
      initialDeposit: Number(row.initial_deposit),
      learningRate: Number(row.learning_rate),
      epsilon: Number(row.epsilon),
      candlesCount: row.candles_count,
      finalBalance: Number(row.final_balance),
      totalPnl: Number(row.total_pnl),
      totalFees: Number(row.total_fees),
      createdAt: row.created_at,
    }));
  }

  public async getById(id: number): Promise<(SimulationSummary & { id: number; createdAt: string }) | null> {
    const row = await this.databaseService.connection<SimulationRunRow>('simulation_runs')
      .select('*')
      .where({ id })
      .first();

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      createdAt: row.created_at,
      ...(JSON.parse(row.result_json) as SimulationSummary),
    };
  }
}
