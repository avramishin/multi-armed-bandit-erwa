import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import knex, { Knex } from "knex";
import fs from "node:fs/promises";
import path from "node:path";
import config from "./knexfile";

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly db: Knex = knex(config);

  public async onModuleInit(): Promise<void> {
    await fs.mkdir(path.join(process.cwd(), "data"), { recursive: true });
    await this.db.migrate.latest();
  }

  public async onModuleDestroy(): Promise<void> {
    await this.db.destroy();
  }

  public get connection(): Knex {
    return this.db;
  }
}
