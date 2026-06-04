import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('simulation_runs', 'candle_interval');

  if (!hasColumn) {
    await knex.schema.alterTable('simulation_runs', (table) => {
      table.string('candle_interval', 8).notNullable().defaultTo('1h');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('simulation_runs', 'candle_interval');

  if (hasColumn) {
    await knex.schema.alterTable('simulation_runs', (table) => {
      table.dropColumn('candle_interval');
    });
  }
}
