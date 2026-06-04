# Multi-Armed Bandit Lab

Лаборатория симуляции торгового агента на `NestJS` с `SQLite + Knex` и статическим frontend из `public/`.

Агент использует простую `epsilon-greedy` стратегию выбора действия и обновляет оценку действия по формуле:

```text
Q(a) <- (1 - alpha) * Q(a) + alpha * reward
```

Где:

- `Q(a)` — текущая оценка действия
- `alpha` — обучаемость (`learningRate`)
- `reward` — нормализованный результат шага

## Что сейчас реализовано

- HTTP-приложение на NestJS
- SQLite-хранилище истории запусков
- Автомиграции при старте приложения
- Статический dashboard без сборщика
- Запуск симуляции через API и через UI
- История последних запусков
- График cumulative PNL
- Tooltip по точкам графика
- Линия базового депозита на графике
- Подсветка выходных дней `UTC` и недельные разделители на графике
- In-memory cache свечей по ключу `symbol + interval + limit`
- Загрузка исторических свечей с Binance Futures public REST API

## Текущее поведение симуляции

На каждом шаге агент выбирает действие из текущего набора:

- `BUY`
- `SELL`

Важно: тип `Action` в коде все еще допускает `IDLE`, и UI/график умеют его показывать, но в текущей реализации симулятора массив действий задан как:

```ts
const ACTIONS: Action[] = ["BUY", "SELL"];
```

То есть фактически агент сейчас работает без `IDLE`.

Логика шага:

1. Если есть открытая позиция, она закрывается по цене текущей свечи.
2. PNL считается с учетом направления позиции, размера позиции и комиссии закрытия.
3. Reward считается от `netPnl` и нормализуется через `tanh(netPnl / tradeSizeUsd)`.
4. Агент обновляет оценку того действия, которое открыло только что закрытую позицию.
5. Затем агент выбирает новое действие и открывает новую позицию.

Позиция не накапливается: одновременно существует только одна открытая позиция.

## Формула PNL

Размер позиции:

```text
notionalUsd = tradeSizeUsd * leverage
quantity = notionalUsd / entryPrice
```

Gross PNL:

```text
BUY:  (exitPrice - entryPrice) * quantity
SELL: (entryPrice - exitPrice) * quantity
```

Net PNL:

```text
netPnl = grossPnl - fees
```

Комиссия в UI задается в процентах, например:

- `0.045` означает `0.045%`
- внутри расчета это переводится в rate через `commissionPercent / 100`

## Параметры симуляции

Через UI/API сейчас доступны:

- `symbol`: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`
- `candleInterval`: `1m`, `5m`, `15m`, `1h`, `4h`, `1d`
- `historySize`
- `initialDeposit`
- `tradeSizeUsd`
- `leverage`
- `commissionPercent`
- `learningRate`
- `epsilon`

Текущие дефолты UI:

- `commissionPercent = 0.045`
- `tradeSizeUsd = 50`
- `leverage = 10`
- `learningRate = 0.10`
- `epsilon = 0.05`

## UI

Dashboard сейчас умеет:

- запускать симуляцию
- менять параметры сделки и обучения
- отображать итоговый баланс, PNL, комиссию, инвестиции и плечо
- показывать линию PNL по шагам
- показывать действие агента на каждом шаге цветом
- показывать tooltip со свечой, временем, reward, step PNL и cumulative PNL
- подсвечивать выходные `UTC`
- открывать сохраненные прошлые запуски

## API

### `POST /api/simulation/run`

Пример тела запроса:

```json
{
  "symbol": "BTCUSDT",
  "candleInterval": "1h",
  "historySize": 240,
  "initialDeposit": 5000,
  "tradeSizeUsd": 50,
  "leverage": 10,
  "commissionPercent": 0.045,
  "learningRate": 0.1,
  "epsilon": 0.05
}
```

### `GET /api/simulation/runs`

Возвращает последние сохраненные запуски.

### `GET /api/simulation/runs/:id`

Возвращает сохраненный запуск целиком, включая точки графика.

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

По умолчанию:

- `HOST=127.0.0.1`
- `PORT=3000`

Пример переопределения:

```bash
HOST=0.0.0.0 PORT=4000 npm run start:dev
```

## Структура проекта

```text
src/
  app.module.ts
  main.ts
  database/
    database.module.ts
    database.service.ts
    migrations/
  simulation/
    dto/
    non-stationary-agent.ts
    simulation.controller.ts
    simulation.market-data.service.ts
    simulation.module.ts
    simulation.repository.ts
    simulation.service.ts
    simulation.types.ts
public/
  index.html
  styles.css
  app.js
```

## Замечания

- Источник свечей сейчас только Binance Futures REST klines endpoint.
- WebSocket market data пока не реализован.
- Cache свечей — in-memory, без persistence между рестартами процесса.
- Текущий `README` описывает фактическое состояние кода, а не исходную идею проекта.
