import { Module } from '@nestjs/common';
import { SimulationController } from './simulation.controller';
import { BinanceMarketDataService } from './simulation.market-data.service';
import { SimulationRepository } from './simulation.repository';
import { SimulationService } from './simulation.service';

@Module({
  controllers: [SimulationController],
  providers: [
    BinanceMarketDataService,
    SimulationRepository,
    SimulationService,
  ],
})
export class SimulationModule {}
