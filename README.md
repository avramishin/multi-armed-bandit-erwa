# Multi-Armed Bandit ERWA

Платформа: `NestJS` | БД: `SQLite + Knex` | UI: статический dashboard из `public/`

Приложение симулирует торгового агента, который на каждой 5-минутной свече выбирает одно из действий:

- `IDLE`
- `BUY`
- `SELL`

Алгоритм обучения: `Non-stationary Multi-Armed Bandit with Exponential Recency-Weighted Average`.

## Что реализовано

- HTTP-приложение на NestJS
- Раздача статического frontend без сборщика
- API для запуска симуляции
- SQLite-хранилище истории запусков
- График изменения cumulative PNL
- Загрузка 5m свечей с Binance Futures public API
- Offline fallback на синтетические свечи, если внешняя сеть недоступна

## Правила симуляции

1. На вход берется последовательность 5-минутных свечей OHLC.
2. На каждом шаге агент выбирает `IDLE`, `BUY` или `SELL`.
3. Каждая сделка открывается на `$50` с плечом `5x`.
4. Комиссия на открытие и закрытие: `0.02%`.
5. Позиция не накапливается: на следующем шаге предыдущая закрывается.
6. `learningRate` и `epsilon` настраиваются через UI/API.
7. Баланс симуляции ведется в рамках стартового депозита.

## Алгоритм

Агент хранит простую таблицу ценностей действий:

```ts
type Action = 'IDLE' | 'BUY' | 'SELL';
Record<Action, number>
```

Выбор действия:

- с вероятностью `epsilon` агент исследует среду и берет случайное действие;
- иначе выбирает действие с максимальным `Q`.

Обновление после reward:

```ts
Q[action] = (1 - learningRate) * Q[action] + learningRate * reward
```

Reward нормализуется через `tanh`, чтобы не раздувать влияние отдельных шагов.

## Запуск

Установка зависимостей:

```bash
npm install
```

Режим разработки:

```bash
npm run start:dev
```

Сборка:

```bash
npm run build
```

Прод-старт после сборки:

```bash
npm start
```

По умолчанию сервер поднимается на `127.0.0.1:3000`.

Можно переопределить:

```bash
HOST=0.0.0.0 PORT=4000 npm run start:dev
```

## UI

Dashboard позволяет:

- выбрать инструмент: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`
- выбрать количество свечей
- выбрать стартовый депозит
- выбрать `learningRate`
- выбрать `epsilon`
- запустить симуляцию
- посмотреть итоговый PNL, баланс и график
- открыть один из последних сохраненных запусков

## API

Запуск симуляции:

```http
POST /api/simulation/run
Content-Type: application/json
```

Пример тела:

```json
{
  "symbol": "BTCUSDT",
  "historySize": 240,
  "initialDeposit": 5000,
  "learningRate": 0.2,
  "epsilon": 0.15
}
```

Получить последние запуски:

```http
GET /api/simulation/runs
```

Получить конкретный запуск:

```http
GET /api/simulation/runs/:id
```

## Структура

```text
src/
  database/
  simulation/
public/
  index.html
  styles.css
  app.js
```

## Замечания

- Сейчас интеграция с Binance использует public REST klines endpoint.
- WebSocket market data из исходной идеи README пока не реализован.
- В средах без доступа к сети приложение не падает и переключается на синтетические свечи.
