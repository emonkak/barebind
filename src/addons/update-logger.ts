import type { Commit, Lanes } from '../core.js';
import { nameOf } from '../debug.js';
import { getPriorityFromLanes, SyncLane, ViewTransitionLane } from '../lane.js';
import type { Middleware, Update } from '../runtime.js';

// Blue
const RENDER_PHASE_STYLE =
  'color: light-dark(#0b57d0, #4c8df6); font-weight: bold';
// Pink
const COMMIT_PHASE_STYLE =
  'color: light-dark(#b90063, #ff4896); font-weight: bold';
// Gray
const VALUE_STYLE = 'color: light-dark(#5e5d67, #918f9a)';
const RESET_STYLE = '';

export type LoggerAPI = Pick<Console, 'groupCollapsed' | 'groupEnd' | 'log'>;

export class UpdateLogger implements Middleware {
  private readonly _logger: LoggerAPI;

  constructor(logger: LoggerAPI = window.console) {
    this._logger = logger;
  }

  handle(update: Update, next: (update: Update) => Commit): Commit {
    const renderStart = performance.now();
    try {
      const commit = next(update);
      const renderAfter = performance.now() - renderStart;
      return () => {
        const commitStart: number = performance.now();
        try {
          commit();
        } finally {
          const commitEnd = performance.now();
          const commitAfter = commitEnd - commitStart;
          const totalDuration = commitEnd - renderStart;
          emitLog(
            this._logger,
            update,
            renderAfter,
            commitAfter,
            totalDuration,
          );
        }
      };
    } catch (error) {
      const totalDuration = performance.now() - renderStart;
      emitLog(this._logger, update, -1, -1, totalDuration);
      throw error;
    }
  }
}

function emitLog(
  logger: LoggerAPI,
  update: Update,
  renderAfter: number,
  commitAfter: number,
  totalDuration: number,
): void {
  const status = renderAfter >= 0 ? 'COMPLETED' : 'FAILED';
  const priority = getPriorityFromLanes(update.lanes);
  const mode = getUpdateMode(update.lanes);
  const owner = nameOf(update.transaction.scope.owner);

  logger.groupCollapsed(
    `Update #${update.id} ${status} with %c${mode}%c mode and %c${priority}%c priority in %c${totalDuration}ms`,
    VALUE_STYLE,
    RESET_STYLE,
    VALUE_STYLE,
    RESET_STYLE,
    VALUE_STYLE,
  );
  if (renderAfter >= 0) {
    logger.log(
      `%cRENDER PHASE:%c Rendered %c<${owner}>%c after %c${renderAfter}ms`,
      RENDER_PHASE_STYLE,
      RESET_STYLE,
      VALUE_STYLE,
      RESET_STYLE,
      VALUE_STYLE,
    );
  } else {
    logger.log(
      `%cRENDER PHASE:%c Failed %c<${owner}>`,
      RENDER_PHASE_STYLE,
      RESET_STYLE,
      VALUE_STYLE,
    );
  }
  if (commitAfter >= 0) {
    logger.log(
      `%cCOMMIT PHASE:%c Committed %c<${owner}>%c after %c${commitAfter}ms`,
      COMMIT_PHASE_STYLE,
      RESET_STYLE,
      VALUE_STYLE,
      RESET_STYLE,
      VALUE_STYLE,
    );
  }
  logger.groupEnd();
}

function getUpdateMode(lanes: Lanes): string {
  return lanes & SyncLane
    ? 'synchronous'
    : lanes & ViewTransitionLane
      ? 'view-transition'
      : 'animation-frame';
}
