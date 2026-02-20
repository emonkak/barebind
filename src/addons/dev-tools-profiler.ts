import { CommitPhase } from '../internal.js';
import type { RuntimeEvent, RuntimeObserver } from '../runtime.js';

export type UserTimingAPI = Pick<Performance, 'mark' | 'measure'>;

export class DevToolsProfiler implements RuntimeObserver {
  private readonly _userTiming: UserTimingAPI;

  private _componentIndex: number = 0;

  constructor(userTiming: UserTimingAPI = performance) {
    this._userTiming = userTiming;
  }

  onRuntimeEvent(event: RuntimeEvent): void {
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
      case 'render-phase-start': {
        const startMark = `barebind:render-phase-start:${id}`;
        this._mark(startMark);
        break;
      }
      case 'render-phase-end': {
        const startMark = `barebind:render-phase-start:${id}`;
        const endMark = `barebind:render-phase-end:${id}`;
        this._mark(endMark);
        this._measure(`Barebind - Render phase #${id}`, startMark, endMark);
        break;
      }
      case 'component-render-start': {
        const index = this._componentIndex;
        const { name } = event.component;
        const startMark = `barebind:component-render-start:${id}:${name}:${index}`;
        this._mark(startMark);
        break;
      }
      case 'component-render-end': {
        const index = this._componentIndex++;
        const { name } = event.component;
        const startMark = `barebind:component-render-start:${id}:${name}:${index}`;
        const endMark = `barebind:component-render-end:${id}:${name}:${index}`;
        this._mark(endMark);
        this._measure(`Barebind - Render ${name} #${id}`, startMark, endMark);
        break;
      }
      case 'commit-phase-start': {
        const startMark = `barebind:commit-phase-start:${id}`;
        this._mark(startMark);
        break;
      }
      case 'commit-phase-end': {
        const startMark = `barebind:commit-phase-start:${id}`;
        const endMark = `barebind:commit-phase-end:${id}`;
        this._mark(endMark);
        this._measure(`Barebind - Commit phase #${id}`, startMark, endMark);
        break;
      }
      case 'effect-commit-start': {
        const phaseName = getPhaseName(event.phase);
        const startMark = `barebind:effect-commit-start:${phaseName}:${id}`;
        this._mark(startMark);
        break;
      }
      case 'effect-commit-end': {
        const phaseName = getPhaseName(event.phase);
        const startMark = `barebind:effect-commit-start:${phaseName}:${id}`;
        const endMark = `barebind:effect-commit-end:${phaseName}:${id}`;
        this._mark(endMark);
        this._measure(
          `Barebind - Commit ${phaseName} effects #${id}`,
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

function getPhaseName(phase: CommitPhase): string {
  return Object.keys(CommitPhase)[phase]!.toLowerCase();
}
