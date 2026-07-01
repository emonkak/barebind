import type { Commit, Lanes, Middleware, Update } from '../core.js';
import { getOwnerStack, nameOf } from '../debug.js';
import { getPriorityFromLanes, SyncLane, ViewTransitionLane } from '../lane.js';

// Blue
const COMPLETE_STYLE = 'color: light-dark(#0b57d0, #4c8df6)';
// Red
const FAILED_STYLE = 'color: light-dark(#b3261e, #e46962)';
// Orange
const VALUE_STYLE = 'color: light-dark(#9f4312, #e96723)';
// Gray
const DURATION_STYLE = 'color: light-dark(#5e5d67, #918f9a)';
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
  const statusStyle = renderAfter >= 0 ? COMPLETE_STYLE : FAILED_STYLE;
  const priority = getPriorityFromLanes(update.lanes);
  const mode = getCommitMode(update.lanes);
  const scope = update.transaction.scope;
  const ownerName = nameOf(scope.owner);
  const ownerStack = getOwnerStack(scope).map(nameOf).join(' > ');

  logger.groupCollapsed(
    `Update #${update.id} for %c${ownerName}%c %c${status}%c in %c${totalDuration}ms`,
    statusStyle,
    RESET_STYLE,
    VALUE_STYLE,
    RESET_STYLE,
    DURATION_STYLE,
  );
  logger.log(`Triggered by %c${ownerStack}`, VALUE_STYLE);
  if (renderAfter >= 0) {
    logger.log(
      `Rendered with %c${priority}%c priority after %c${renderAfter}ms`,
      VALUE_STYLE,
      RESET_STYLE,
      DURATION_STYLE,
    );
  }
  if (commitAfter >= 0) {
    logger.log(
      `Committed with %c${mode}%c mode after %c${commitAfter}ms`,
      VALUE_STYLE,
      RESET_STYLE,
      DURATION_STYLE,
    );
  }
  logger.groupEnd();
}

function getCommitMode(lanes: Lanes): string {
  return lanes & SyncLane
    ? 'synchronous'
    : lanes & ViewTransitionLane
      ? 'view-transition'
      : 'animation-frame';
}
