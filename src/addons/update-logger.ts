import type { Commit, Lanes, Middleware, Update } from '../core.js';
import { getOwnerStack, nameOf } from '../debug.js';
import { getPriorityFromLanes, SyncLane, ViewTransitionLane } from '../lane.js';

const RED_STYLE = 'color: light-dark(#b3261e, #e46962)';
const BLUE_STYLE = 'color: light-dark(#0b57d0, #4c8df6)';
const ORANGE_STYLE = 'color: light-dark(#9f4312, #e96723)';
const GRAY_STYLE = 'color: light-dark(#5e5d67, #918f9a)';
const BOLD_STYLE = 'font-weight: bold';
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
  const statusStyle = renderAfter >= 0 ? BLUE_STYLE : RED_STYLE;
  const priority = getPriorityFromLanes(update.lanes);
  const mode = getCommitMode(update.lanes);
  const scope = update.transaction.scope;
  const ownerName = nameOf(scope.owner);
  const ownerStack = getOwnerStack(scope).map(nameOf).join(' > ');

  logger.groupCollapsed(
    `Update #${update.id} %c${status}%c at %c${ownerName}%c in %c${totalDuration}ms`,
    statusStyle,
    RESET_STYLE,
    ORANGE_STYLE,
    RESET_STYLE,
    GRAY_STYLE,
  );
  logger.log(`Under %c${ownerStack}`, BOLD_STYLE);
  if (renderAfter >= 0) {
    logger.log(
      `Rendered with %c${priority}%c priority after %c${renderAfter}ms`,
      BOLD_STYLE,
      RESET_STYLE,
      GRAY_STYLE,
    );
  }
  if (commitAfter >= 0) {
    logger.log(
      `Committed with %c${mode}%c mode after %c${commitAfter}ms`,
      BOLD_STYLE,
      RESET_STYLE,
      GRAY_STYLE,
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
