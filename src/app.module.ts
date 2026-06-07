import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import path from 'node:path';
import { DatabaseModule } from './database/database.module';
import { SimulationModule } from './simulation/simulation.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), 'public'),
      exclude: ['/api/{*path}'],
    }),
    DatabaseModule,
    SimulationModule,
  ],
})
export class AppModule {}
