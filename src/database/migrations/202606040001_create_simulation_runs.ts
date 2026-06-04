import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('simulation_runs', (table) => {
    table.increments('id').primary();
    table.string('symbol', 32).notNullable();
    table.integer('history_size').notNullable();
    table.decimal('initial_deposit', 14, 2).notNullable();
    table.decimal('learning_rate', 8, 4).notNullable();
    table.decimal('epsilon', 8, 4).notNullable();
    table.integer('candles_count').notNullable();
    table.decimal('final_balance', 14, 4).notNullable();
    table.decimal('total_pnl', 14, 4).notNullable();
    table.decimal('total_fees', 14, 4).notNullable();
    table.text('result_json').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('simulation_runs');
}
