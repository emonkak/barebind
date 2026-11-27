import type {
  Commit,
  Dispatcher,
  Lanes,
  Middleware,
  Update,
} from '../abstractions.js';
import { captureOwnerStack, nameOf } from '../debug.js';
import { getPriorityFromLanes, Lane } from '../lane.js';

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

  handle(
    update: Update,
    dispatcher: Dispatcher,
    prepare: (update: Update, dispatcher: Dispatcher) => Commit,
  ): Commit {
    const renderStart = performance.now();
    try {
      const commit = prepare(update, dispatcher);
      const renderDuration = performance.now() - renderStart;
      return () => {
        const commitStart: number = performance.now();
        try {
          commit();
        } finally {
          const commitEnd = performance.now();
          const commitDuration = commitEnd - commitStart;
          const totalDuration = commitEnd - renderStart;
          emitLog(
            this._logger,
            update,
            dispatcher.txId,
            renderDuration,
            commitDuration,
            totalDuration,
          );
        }
      };
    } catch (error) {
      const totalDuration = performance.now() - renderStart;
      emitLog(this._logger, update, dispatcher.txId, -1, -1, totalDuration);
      throw error;
    }
  }
}

function emitLog(
  logger: LoggerAPI,
  update: Update,
  txId: number,
  renderDuration: number,
  commitDuration: number,
  totalDuration: number,
): void {
  const status = renderDuration >= 0 ? 'COMPLETED' : 'FAILED';
  const statusStyle = renderDuration >= 0 ? BLUE_STYLE : RED_STYLE;
  const priority = getPriorityFromLanes(update.lanes);
  const mode = getCommitMode(update.lanes);
  const scope = update.transaction.scope;
  const ownerName = nameOf(scope.owner);
  const ownerStack = captureOwnerStack(scope).map(nameOf).join(' > ');

  logger.groupCollapsed(
    `Update #${update.id} %c${status}%c at %c${ownerName}%c in %c${totalDuration.toFixed(1)}ms (tx${txId})`,
    statusStyle,
    RESET_STYLE,
    ORANGE_STYLE,
    RESET_STYLE,
    GRAY_STYLE,
  );
  logger.log(`Under %c${ownerStack}`, BOLD_STYLE);
  if (renderDuration >= 0) {
    logger.log(
      `Rendered with %c${priority}%c priority after %c${renderDuration.toFixed(1)}ms`,
      BOLD_STYLE,
      RESET_STYLE,
      GRAY_STYLE,
    );
  }
  if (commitDuration >= 0) {
    logger.log(
      `Committed with %c${mode}%c mode after %c${commitDuration.toFixed(1)}ms`,
      BOLD_STYLE,
      RESET_STYLE,
      GRAY_STYLE,
    );
  }
  logger.groupEnd();
}

function getCommitMode(lanes: Lanes): string {
  return lanes & Lane.SyncLane
    ? 'synchronous'
    : lanes & Lane.UserHandlerLane
      ? 'user-handler'
      : 'animation-frame';
}
