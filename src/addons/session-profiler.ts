/// <reference path="../../typings/scheduler.d.ts" />

import {
  type CommitPhase,
  getPriorityFromLanes,
  Lane,
  type Lanes,
  type SessionEvent,
  type SessionObserver,
} from '../core.js';
import { InterruptError } from '../error.js';

// Blue
const RENDER_PHASE_STYLE =
  'color: light-dark(#0b57d0, #4c8df6); font-weight: bold';
// Pink
const COMMIT_PHASE_STYLE =
  'color: light-dark(#b90063, #ff4896); font-weight: bold';
const EFFECT_STYLES: Record<CommitPhase, string> = {
  // Orange
  mutation: 'color: light-dark(#9f4312, #e96725); font-weight: bold',
  // Purple
  layout: 'color: light-dark(#8c1ed3, #bf67ff); font-weight: bold',
  // Green
  passive: 'color: light-dark(#146c2e, #1ea446); font-weight: bold',
};
// Gray
const DURATION_STYLE =
  'color: light-dark(#5e5d67, #918f9a); font-weight: normal';
const DEFAULT_STYLE = 'font-weight: normal';

export type ConsoleLogger = Pick<
  Console,
  'group' | 'groupCollapsed' | 'groupEnd' | 'log' | 'table'
>;

export interface CommitMeasurement {
  startTime: number;
  duration: number;
}

export interface ComponentRecord {
  name: string;
  startTime: number;
  duration: number;
}

export interface EffectRecord {
  phase: CommitPhase;
  startTime: number;
  duration: number;
  pendingCount: number;
  commitCount: number;
}

export interface ErrorRecord {
  error: unknown;
  captured: boolean;
}

export interface RenderMeasurement {
  startTime: number;
  duration: number;
}

export interface SessionProfile {
  id: number;
  phase: 'prerender' | 'postrender' | 'precommit' | 'postcommit';
  status: 'pending' | 'succeeded' | 'failed' | 'interrupted';
  updateMeasurement: UpdateMeasurement | null;
  renderMeasurement: RenderMeasurement | null;
  commitMeasurement: CommitMeasurement | null;
  errorRecords: ErrorRecord[];
  componentRecords: ComponentRecord[];
  effectRecords: EffectRecord[];
}

export interface SessionProfileReporter {
  reportProfile(profile: SessionProfile): void;
}

export interface UpdateMeasurement {
  startTime: number;
  duration: number;
  lanes: Lanes;
}

export class SessionProfiler implements SessionObserver {
  private readonly _reporter: SessionProfileReporter;

  private readonly _pendingProfiles: Map<number, SessionProfile> = new Map();

  constructor(reporter: SessionProfileReporter) {
    this._reporter = reporter;
  }

  onSessionEvent(event: SessionEvent): void {
    let profile = this._pendingProfiles.get(event.id);

    if (profile === undefined) {
      if (event.type === 'update-start') {
        profile = createProfile(event.id);
        this._pendingProfiles.set(event.id, profile);
      } else {
        return;
      }
    }

    switch (event.type) {
      case 'update-start':
        profile.updateMeasurement = {
          startTime: performance.now(),
          duration: 0,
          lanes: event.lanes,
        };
        break;
      case 'update-end': {
        const measurement = profile.updateMeasurement;
        if (measurement !== null) {
          measurement.duration = performance.now() - measurement.startTime;
        }
        profile.status = event.aborted
          ? event.reason instanceof InterruptError
            ? 'interrupted'
            : 'failed'
          : 'succeeded';
        break;
      }
      case 'render-start':
        profile.renderMeasurement = {
          startTime: performance.now(),
          duration: 0,
        };
        profile.phase = 'prerender';
        break;
      case 'render-end': {
        const measurement = profile.renderMeasurement;
        if (measurement !== null) {
          measurement.duration = performance.now() - measurement.startTime;
        }
        profile.phase = 'postrender';
        break;
      }
      case 'render-error': {
        const { error, captured } = event;
        profile.errorRecords.push({
          error,
          captured,
        });
        break;
      }
      case 'component-render-start':
        profile.componentRecords.push({
          name: event.component.name,
          startTime: performance.now(),
          duration: 0,
        });
        break;
      case 'component-render-end': {
        const record = profile.componentRecords.at(-1);
        if (record !== undefined) {
          record.duration = performance.now() - record.startTime;
        }
        break;
      }
      case 'commit-start':
        profile.commitMeasurement = {
          startTime: performance.now(),
          duration: 0,
        };
        profile.phase = 'precommit';
        break;
      case 'commit-end': {
        const measurement = profile.commitMeasurement;
        if (measurement !== null) {
          measurement.duration = performance.now() - measurement.startTime;
        }
        profile.phase = 'postcommit';
        break;
      }
      case 'effect-commit-start': {
        profile.effectRecords.push({
          phase: event.phase,
          startTime: performance.now(),
          duration: 0,
          pendingCount: event.effects.size,
          commitCount: 0,
        });
        break;
      }
      case 'effect-commit-end': {
        const record = profile.effectRecords.at(-1);
        if (record !== undefined) {
          record.duration = performance.now() - record.startTime;
          record.commitCount = record.pendingCount - event.effects.size;
          record.pendingCount = event.effects.size;
        }
        break;
      }
    }

    if (
      (profile.phase === 'postrender' &&
        (profile.status === 'failed' || profile.status === 'interrupted')) ||
      (profile.phase === 'postcommit' && profile.status === 'succeeded')
    ) {
      this._reporter.reportProfile(profile);
      this._pendingProfiles.delete(profile.id);
    }
  }
}

export class ConsoleReporter implements SessionProfileReporter {
  private readonly _logger: ConsoleLogger;

  constructor(logger: ConsoleLogger = console) {
    this._logger = logger;
  }

  reportProfile(profile: SessionProfile): void {
    const {
      status,
      updateMeasurement,
      renderMeasurement,
      errorRecords,
      componentRecords,
      effectRecords,
      commitMeasurement,
    } = profile;

    if (updateMeasurement === null) {
      return;
    }

    const { lanes } = updateMeasurement;
    const kindLabel = getUpdateKind(lanes);
    const statusLabel = status.toUpperCase();
    const priority = getPriorityFromLanes(lanes);
    const priorityLabel =
      priority !== null ? `with ${priority} priority` : 'without priority';
    const mode = getUpdateMode(lanes);
    const modeLabel = `in ${mode} mode`;

    this._logger.groupCollapsed(
      `#${profile.id} ${kindLabel} ${statusLabel} ${priorityLabel} ${modeLabel} after %c${updateMeasurement.duration}ms`,
      DURATION_STYLE,
    );

    if (renderMeasurement !== null) {
      this._logger.group(
        `%cRENDER PHASE:%c ${componentRecords.length} component(s) rendered after %c${renderMeasurement.duration}ms`,
        RENDER_PHASE_STYLE,
        DEFAULT_STYLE,
        DURATION_STYLE,
      );
      if (errorRecords.length > 0) {
        this._logger.table(errorRecords, ['error', 'captured']);
      }
      if (componentRecords.length > 0) {
        this._logger.table(componentRecords, ['name', 'duration']);
      }
      this._logger.groupEnd();
    }

    if (commitMeasurement !== null) {
      const totalCommits = effectRecords.reduce(
        (totalCommits, { commitCount }) => totalCommits + commitCount,
        0,
      );
      this._logger.group(
        `%cCOMMIT PHASE:%c ${totalCommits} effect(s) committed after %c${commitMeasurement.duration}ms`,
        COMMIT_PHASE_STYLE,
        DEFAULT_STYLE,
        DURATION_STYLE,
      );
      for (const { phase, commitCount, duration } of effectRecords) {
        this._logger.log(
          `%c${phase.toUpperCase()} PHASE:%c ${commitCount} effect(s) committed in %c${duration}ms`,
          EFFECT_STYLES[phase],
          DEFAULT_STYLE,
          DURATION_STYLE,
        );
      }
      this._logger.groupEnd();
    }

    this._logger.groupEnd();
  }
}

function createProfile(id: number): SessionProfile {
  return {
    id,
    phase: 'prerender',
    status: 'pending',
    updateMeasurement: null,
    renderMeasurement: null,
    commitMeasurement: null,
    errorRecords: [],
    componentRecords: [],
    effectRecords: [],
  };
}

function getUpdateKind(lanes: Lanes): string {
  const tags = [];
  if (lanes & Lane.TransitionLane) {
    tags.push('Transition');
  }
  if (lanes & Lane.ViewTransitionLane) {
    tags.push('ViewTransition');
  }
  return tags.length > 0 ? tags.join('/') : 'Update';
}

function getUpdateMode(lanes: Lanes): string {
  return lanes & Lane.SyncLane ? 'sync' : 'concurrent';
}
