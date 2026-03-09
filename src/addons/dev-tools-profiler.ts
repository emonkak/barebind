import type { SessionEvent, SessionObserver } from '../core.js';

export type UserTimingAPI = Pick<Performance, 'mark' | 'measure'>;

export class DevToolsProfiler implements SessionObserver {
  private readonly _userTiming: UserTimingAPI;

  private _componentIndex: number = 0;

  constructor(userTiming: UserTimingAPI = performance) {
    this._userTiming = userTiming;
  }

  onSessionEvent(event: SessionEvent): void {
    const { id, type } = event;
    switch (type) {
      case 'update-start': {
        const startMark = `barebind:update-start:${id}`;
        this._mark(startMark);
        this._componentIndex = 0;
        break;
      }
      case 'update-success': {
        const startMark = `barebind:update-start:${id}`;
        const endMark = `barebind:update-end:${id}`;
        this._mark(endMark);
        this._measure(`Barebind - Update success #${id}`, startMark, endMark);
        break;
      }
      case 'update-failure': {
        const startMark = `barebind:update-start:${id}`;
        const endMark = `barebind:update-end:${id}`;
        this._mark(endMark);
        this._measure(`Barebind - Update failure #${id}`, startMark, endMark);
        break;
      }
      case 'render-start': {
        const startMark = `barebind:render-start:${id}`;
        this._mark(startMark);
        break;
      }
      case 'render-end': {
        const startMark = `barebind:render-start:${id}`;
        const endMark = `barebind:render-end:${id}`;
        this._mark(endMark);
        this._measure(`Barebind - Render phase #${id}`, startMark, endMark);
        break;
      }
      case 'component-render-start': {
        const { name } = event.component;
        const index = this._componentIndex;
        const startMark = `barebind:component-render-start:${id}:${name}:${index}`;
        this._mark(startMark);
        break;
      }
      case 'component-render-end': {
        const { name } = event.component;
        const index = this._componentIndex++;
        const startMark = `barebind:component-render-start:${id}:${name}:${index}`;
        const endMark = `barebind:component-render-end:${id}:${name}:${index}`;
        this._mark(endMark);
        this._measure(`Barebind - Render ${name} #${id}`, startMark, endMark);
        break;
      }
      case 'commit-start': {
        const startMark = `barebind:commit-start:${id}`;
        this._mark(startMark);
        break;
      }
      case 'commit-end': {
        const startMark = `barebind:commit-start:${id}`;
        const endMark = `barebind:commit-end:${id}`;
        this._mark(endMark);
        this._measure(`Barebind - Commit phase #${id}`, startMark, endMark);
        break;
      }
      case 'effect-commit-start': {
        const { phase } = event;
        const startMark = `barebind:effect-commit-start:${phase}:${id}`;
        this._mark(startMark);
        break;
      }
      case 'effect-commit-end': {
        const { phase } = event;
        const startMark = `barebind:effect-commit-start:${phase}:${id}`;
        const endMark = `barebind:effect-commit-end:${phase}:${id}`;
        this._mark(endMark);
        this._measure(
          `Barebind - Commit ${phase} effects #${id}`,
          startMark,
          endMark,
        );
        break;
      }
    }
  }

  private _mark(name: string): void {
    this._userTiming.mark(name);
  }

  private _measure(name: string, startMark: string, endMark: string): void {
    try {
      this._userTiming.measure(name, startMark, endMark);
    } catch {
      // startMark may not exist if profiling started mid-flight; silently ignore.
    }
  }
}
