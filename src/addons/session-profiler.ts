/// <reference path="../../typings/scheduler.d.ts" />

import type {
  CommitPhase,
  Lanes,
  SessionEvent,
  SessionObserver,
} from '../core.js';
import {
  ConcurrentLane,
  getPriorityFromLanes,
  NoLanes,
  SyncLane,
  TransitionLane,
  ViewTransitionLane,
} from '../lane.js';

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
  endTime: number;
}

export interface ComponentRecord {
  name: string;
  startTime: number;
  endTime: number;
}

export interface EffectRecord {
  phase: CommitPhase;
  startTime: number;
  endTime: number;
  effectCount: number;
}

export interface ErrorRecord {
  error: unknown;
  captured: boolean;
}

export interface RenderMeasurement {
  startTime: number;
  endTime: number;
  lanes: Lanes;
}

export interface SessionProfile {
  id: number;
  phase: 'idle' | 'prerender' | 'postrender' | 'precommit' | 'postcommit';
  status: 'pending' | 'completed' | 'interrupted';
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
  endTime: number;
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
      profile = createProfile(event.id);
      this._pendingProfiles.set(event.id, profile);
    }

    switch (event.type) {
      case 'render-start':
        profile.renderMeasurement = {
          startTime: performance.now(),
          endTime: 0,
          lanes: event.lanes,
        };
        profile.phase = 'prerender';
        break;
      case 'render-end': {
        const measurement = profile.renderMeasurement;
        if (measurement !== null) {
          measurement.endTime = performance.now();
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
          endTime: 0,
        });
        break;
      case 'component-render-end': {
        const record = profile.componentRecords.at(-1);
        if (record !== undefined) {
          record.endTime = performance.now();
        }
        break;
      }
      case 'commit-start':
        profile.commitMeasurement = {
          startTime: performance.now(),
          endTime: 0,
        };
        profile.phase = 'precommit';
        break;
      case 'commit-end': {
        const measurement = profile.commitMeasurement;
        if (measurement !== null) {
          measurement.endTime = performance.now();
        }
        profile.phase = 'postcommit';
        profile.status = 'completed';
        break;
      }
      case 'commit-cancel':
        profile.phase = 'postcommit';
        profile.status = 'interrupted';
        break;
      case 'effect-commit-start': {
        profile.effectRecords.push({
          phase: event.phase,
          startTime: performance.now(),
          endTime: 0,
          effectCount: event.effects.size,
        });
        break;
      }
      case 'effect-commit-end': {
        const record = profile.effectRecords.at(-1);
        if (record !== undefined) {
          record.endTime = performance.now();
        }
        break;
      }
    }

    if (profile.phase === 'postcommit' && profile.status !== 'pending') {
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
      renderMeasurement,
      errorRecords,
      componentRecords,
      effectRecords,
      commitMeasurement,
    } = profile;

    const lanes = renderMeasurement?.lanes ?? NoLanes;
    const kindLabel = getUpdateKind(lanes);
    const statusLabel = status.toUpperCase();
    const priority = getPriorityFromLanes(lanes);
    const priorityLabel =
      priority !== null ? `with ${priority} priority` : 'without priority';
    const mode = getUpdateMode(lanes);
    const modeLabel = `in ${mode} mode`;
    const totalDuration = getDuration(
      renderMeasurement?.startTime ?? 0,
      (commitMeasurement ?? renderMeasurement)?.endTime ?? 0,
    );

    this._logger.groupCollapsed(
      `#${profile.id} ${kindLabel} ${statusLabel} ${priorityLabel} ${modeLabel} after %c${totalDuration}ms`,
      DURATION_STYLE,
    );

    if (renderMeasurement !== null) {
      const { startTime, endTime } = renderMeasurement;
      const renderDuration = getDuration(startTime, endTime);
      this._logger.group(
        `%cRENDER PHASE:%c ${componentRecords.length} component(s) rendered after %c${renderDuration}ms`,
        RENDER_PHASE_STYLE,
        DEFAULT_STYLE,
        DURATION_STYLE,
      );
      if (errorRecords.length > 0) {
        this._logger.table(errorRecords, ['error', 'captured']);
      }
      if (componentRecords.length > 0) {
        this._logger.table(
          componentRecords.map(({ name, startTime, endTime }) => ({
            name,
            duration: getDuration(startTime, endTime),
          })),
        );
      }
      this._logger.groupEnd();
    }

    if (commitMeasurement !== null) {
      const { startTime, endTime } = commitMeasurement;
      const commitDuration = getDuration(startTime, endTime);
      const totalEffects = effectRecords.reduce(
        (totalCommits, { effectCount }) => totalCommits + effectCount,
        0,
      );
      this._logger.group(
        `%cCOMMIT PHASE:%c ${totalEffects} effect(s) committed after %c${commitDuration}ms`,
        COMMIT_PHASE_STYLE,
        DEFAULT_STYLE,
        DURATION_STYLE,
      );
      for (const { phase, effectCount, startTime, endTime } of effectRecords) {
        const effectDuration = getDuration(startTime, endTime);
        this._logger.log(
          `%c${phase.toUpperCase()} PHASE:%c ${effectCount} effect(s) committed in %c${effectDuration}ms`,
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
    phase: 'idle',
    status: 'pending',
    renderMeasurement: null,
    commitMeasurement: null,
    errorRecords: [],
    componentRecords: [],
    effectRecords: [],
  };
}

function getDuration(startTime: number, endTime: number): number {
  return Math.max(0, endTime - startTime);
}

function getUpdateKind(lanes: Lanes): string {
  const tags = [];
  if (lanes & TransitionLane) {
    tags.push('Transition');
  }
  if (lanes & ViewTransitionLane) {
    tags.push('ViewTransition');
  }
  return tags.length > 0 ? tags.join('/') : 'Update';
}

function getUpdateMode(lanes: Lanes): string {
  return lanes & SyncLane
    ? 'sync'
    : lanes & ConcurrentLane
      ? 'concurrent'
      : 'no';
}
