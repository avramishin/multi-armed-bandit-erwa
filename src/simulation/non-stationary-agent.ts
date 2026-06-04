import { Action } from "./simulation.types";

export interface AgentOptions {
  learningRate?: number;
  epsilon?: number;
}

export class NonStationaryAgent {
  private readonly actions: Action[];
  private readonly lr: number;
  private readonly epsilon: number;
  private readonly qTable: Record<Action, number>;

  constructor(actions: Action[], options: AgentOptions = {}) {
    this.actions = actions;
    this.lr = options.learningRate ?? 0.2;
    this.epsilon = options.epsilon ?? 0.15;
    this.qTable = actions.reduce(
      (acc, action) => {
        acc[action] = 0;
        return acc;
      },
      {} as Record<Action, number>,
    );
  }

  public chooseAction(): Action {
    if (Math.random() < this.epsilon) {
      const randomIndex = Math.floor(Math.random() * this.actions.length);
      return this.actions[randomIndex];
    }

    return this.getBestAction();
  }

  public learn(action: Action, reward: number): void {
    const clampedReward = Math.max(-1, Math.min(1, reward));
    const currentQ = this.qTable[action];
    this.qTable[action] = (1 - this.lr) * currentQ + this.lr * clampedReward;
  }

  public getMemorySnapshot(): Record<Action, number> {
    return { ...this.qTable };
  }

  private getBestAction(): Action {
    let bestAction = this.actions[0];
    let maxQ = this.qTable[bestAction];

    for (const action of this.actions) {
      if (this.qTable[action] > maxQ) {
        bestAction = action;
        maxQ = this.qTable[action];
      }
    }

    return bestAction;
  }
}
