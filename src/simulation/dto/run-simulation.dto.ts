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
  @Min(0.01)
  @Max(1)
  learningRate!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(0.9)
  epsilon!: number;
}
