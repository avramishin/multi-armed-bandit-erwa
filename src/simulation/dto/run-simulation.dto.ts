import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  Max,
  Min,
} from 'class-validator';

export class RunSimulationDto {
  @IsIn(['BTCUSDT', 'ETHUSDT', 'SOLUSDT'])
  symbol!: 'BTCUSDT' | 'ETHUSDT' | 'SOLUSDT';

  @IsIn(['1m', '5m', '15m', '1h', '4h', '1d'])
  candleInterval!: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

  @Type(() => Number)
  @IsNumber()
  @Min(50)
  @Max(3000)
  historySize!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(100000)
  initialDeposit!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100000)
  tradeSizeUsd!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(125)
  leverage!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercent!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  learningRate!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  epsilon!: number;
}
