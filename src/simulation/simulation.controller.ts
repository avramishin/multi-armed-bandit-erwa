import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Body,
} from '@nestjs/common';
import { RunSimulationDto } from './dto/run-simulation.dto';
import { SimulationService } from './simulation.service';

@Controller('simulation')
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Post('run')
  public async run(@Body() dto: RunSimulationDto): Promise<unknown> {
    const result = await this.simulationService.runSimulation(dto);

    return {
      id: result.id,
      ...result.summary,
    };
  }

  @Get('runs')
  public async listRuns(): Promise<Array<Record<string, unknown>>> {
    return this.simulationService.listRecentRuns();
  }

  @Get('runs/:id')
  public async getRun(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<unknown> {
    const result = await this.simulationService.getRun(id);

    if (!result) {
      throw new NotFoundException(`Simulation run ${id} not found`);
    }

    return result;
  }
}
