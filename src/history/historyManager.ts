export interface Command {
  execute(): void;
  undo(): void;
  description: string;
}

type Listener = () => void;

class HistoryManager {
  private past: Command[] = [];
  private future: Command[] = [];
  private readonly maxSize = 200;
  private listeners = new Set<Listener>();

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  /** Subscribe to any history change. Returns an unsubscribe function. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  execute(cmd: Command): void {
    cmd.execute();
    this.past.push(cmd);
    this.future = [];
    if (this.past.length > this.maxSize) this.past.shift();
    this.notify();
  }

  /** Push a command that has already been applied — records it without re-executing. */
  push(cmd: Command): void {
    this.past.push(cmd);
    this.future = [];
    if (this.past.length > this.maxSize) this.past.shift();
    this.notify();
  }

  undo(): void {
    const cmd = this.past.pop();
    if (!cmd) return;
    cmd.undo();
    this.future.push(cmd);
    this.notify();
  }

  redo(): void {
    const cmd = this.future.pop();
    if (!cmd) return;
    cmd.execute();
    this.past.push(cmd);
    this.notify();
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.notify();
  }
}

export const historyManager = new HistoryManager();
