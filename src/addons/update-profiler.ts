import type { Commit, Middleware, Update } from '../core.js';
import { nameOf } from '../debug.js';

export type UserTimingAPI = Pick<Performance, 'mark' | 'measure'>;

export class UpdateProfiler implements Middleware {
  private readonly _userTiming: UserTimingAPI;

  constructor(userTiming: UserTimingAPI = window.performance) {
    this._userTiming = userTiming;
  }

  handle(update: Update, next: (update: Update) => Commit): Commit {
    const renderStartMark = `barebind:render-start:${update.id}`;
    const renderEndMark = `barebind:render-end:${update.id}`;
    const commitStartMark = `barebind:commit-start:${update.id}`;
    const commitEndMark = `barebind:commit-end:${update.id}`;

    this._userTiming.mark(renderStartMark);
    const commit = next(update);
    this._userTiming.mark(renderEndMark);

    return () => {
      const name = nameOf(update.transaction.scope.owner);
      this._userTiming.mark(commitStartMark);
      commit();
      this._userTiming.mark(commitEndMark);
      this._userTiming.measure(
        `Update <${name}>`,
        renderStartMark,
        commitEndMark,
      );
      this._userTiming.measure(
        `Render <${name}>`,
        renderStartMark,
        renderEndMark,
      );
      this._userTiming.measure(
        `Commit <${name}>`,
        commitStartMark,
        commitEndMark,
      );
    };
  }
}
