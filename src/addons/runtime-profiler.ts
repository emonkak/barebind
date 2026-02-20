/// <reference path="../../typings/scheduler.d.ts" />

import {
  CommitPhase,
  getPriorityFromLanes,
  Lane,
  type Lanes,
} from '../internal.js';
import type { RuntimeEvent, RuntimeObserver } from '../runtime.js';

export interface CommitMeasurement {
  startTime: number;
  duration: number;
  pendingEffects: number;
  committedEffects: number;
}

export interface ComponentMeasurement {
  name: string;
  startTime: number;
  duration: number;
}

export interface RuntimeProfile {
  id: number;
  status: 'pending' | 'success' | 'failure';
  phase: 'idle' | 'render' | 'commit';
  updateMeasurement: UpdateMeasurement | null;
  renderMeasurement: RenderMeasurement | null;
  componentMeasurements: ComponentMeasurement[];
  commitMeasurement: CommitMeasurement | null;
  mutationMeasurement: CommitMeasurement | null;
  layoutMeasurement: CommitMeasurement | null;
  passiveMeasurement: CommitMeasurement | null;
}

export interface RuntimeProfileReporter {
  reportProfile(profile: RuntimeProfile): void;
}

export interface RenderMeasurement {
  startTime: number;
  duration: number;
}

export interface UpdateMeasurement {
  startTime: number;
  duration: number;
  lanes: Lanes;
}

export type ConsoleLogger = Pick<
  Console,
  'group' | 'groupCollapsed' | 'groupEnd' | 'log' | 'table'
>;

// Blue
const RENDER_PHASE_STYLE =
  'color: light-dark(#0b57d0, #4c8df6); font-weight: bold';
// Pink
const COMMIT_PHASE_STYLE =
  'color: light-dark(#b90063, #ff4896); font-weight: bold';
// Orange
const MUTATION_PHASE_STYLE =
  'color: light-dark(#9F4312, #E96725); font-weight: bold';
// Purple
const LAYOUT_PHASE_STYLE =
  'color: light-dark(#8c1ed3, #bf67ff); font-weight: bold';
// Green
const PASSIVE_PHASE_STYLE =
  'color: light-dark(#146c2e, #1ea446); font-weight: bold';
// Gray
const DURATION_STYLE =
  'color: light-dark(#5e5d67, #918f9a); font-weight: normal';
const DEFAULT_STYLE = 'font-weight: normal';

export class RuntimeProfiler implements RuntimeObserver {
  private readonly _reporter: RuntimeProfileReporter;

  private readonly _pendingProfiles: Map<number, RuntimeProfile> = new Map();

  constructor(reporter: RuntimeProfileReporter) {
    this._reporter = reporter;
  }

  onRuntimeEvent(event: RuntimeEvent): void {
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
      case 'update-success': {
        const measurement = profile.updateMeasurement;
        if (measurement !== null) {
          measurement.duration = performance.now() - measurement.startTime;
        }
        profile.status = 'success';
        if (profile.phase === 'idle') {
          this._flushProfile(profile);
        }
        break;
      }
      case 'update-failure': {
        const measurement = profile.updateMeasurement;
        if (measurement !== null) {
          measurement.duration = performance.now() - measurement.startTime;
        }
        profile.status = 'failure';
        this._flushProfile(profile);
        break;
      }
      case 'render-phase-start':
        profile.renderMeasurement = {
          startTime: performance.now(),
          duration: 0,
        };
        profile.phase = 'render';
        break;
      case 'render-phase-end': {
        const measurement = profile.renderMeasurement;
        if (measurement !== null) {
          measurement.duration = performance.now() - measurement.startTime;
        }
        profile.phase = 'idle';
        break;
      }
      case 'component-render-start':
        profile.componentMeasurements.push({
          name: event.component.name,
          startTime: performance.now(),
          duration: 0,
        });
        break;
      case 'component-render-end': {
        const measurement = profile.componentMeasurements.at(-1);
        if (measurement !== undefined) {
          measurement.duration = performance.now() - measurement.startTime;
        }
        break;
      }
      case 'commit-phase-start':
        profile.commitMeasurement = {
          startTime: performance.now(),
          duration: 0,
          pendingEffects:
            event.mutationEffects.length +
            event.layoutEffects.length +
            event.passiveEffects.length,
          committedEffects: 0,
        };
        profile.phase = 'commit';
        break;
      case 'commit-phase-end': {
        const measurement = profile.commitMeasurement;
        if (measurement !== null) {
          const pendingEffects =
            event.mutationEffects.length +
            event.layoutEffects.length +
            event.passiveEffects.length;
          measurement.duration = performance.now() - measurement.startTime;
          measurement.committedEffects =
            measurement.pendingEffects - pendingEffects;
          measurement.pendingEffects = pendingEffects;
        }
        profile.phase = 'idle';
        if (profile.status !== 'pending') {
          this._flushProfile(profile);
        }
        break;
      }
      case 'effect-commit-start': {
        const measurement = {
          startTime: performance.now(),
          duration: 0,
          pendingEffects: event.effects.length,
          committedEffects: 0,
        };
        switch (event.phase) {
          case CommitPhase.Mutation:
            profile.mutationMeasurement = measurement;
            break;
          case CommitPhase.Layout:
            profile.layoutMeasurement = measurement;
            break;
          case CommitPhase.Passive:
            profile.passiveMeasurement = measurement;
            break;
        }
        break;
      }
      case 'effect-commit-end': {
        let measurement: CommitMeasurement | null = null;
        switch (event.phase) {
          case CommitPhase.Mutation:
            measurement = profile.mutationMeasurement;
            break;
          case CommitPhase.Layout:
            measurement = profile.layoutMeasurement;
            break;
          case CommitPhase.Passive:
            measurement = profile.passiveMeasurement;
            break;
        }
        if (measurement !== null) {
          const pendingEffects = event.effects.length;
          measurement.duration = performance.now() - measurement.startTime;
          measurement.committedEffects =
            measurement.pendingEffects - pendingEffects;
          measurement.pendingEffects = pendingEffects;
        }
        break;
      }
    }
  }

  private _flushProfile(profile: RuntimeProfile): void {
    this._reporter.reportProfile(profile);
    this._pendingProfiles.delete(profile.id);
  }
}

export class ConsoleReporter implements RuntimeProfileReporter {
  private readonly _logger: ConsoleLogger;

  constructor(logger: ConsoleLogger = console) {
    this._logger = logger;
  }

  reportProfile(profile: RuntimeProfile): void {
    const {
      status,
      updateMeasurement,
      renderMeasurement,
      componentMeasurements,
      commitMeasurement,
      mutationMeasurement,
      layoutMeasurement,
      passiveMeasurement,
    } = profile;

    if (updateMeasurement === null) {
      return;
    }

    const viewTransition =
      (updateMeasurement.lanes & Lane.ViewTransitionLane) !== 0;
    const priority = getPriorityFromLanes(updateMeasurement.lanes);
    const titleLablel = viewTransition ? 'Transition' : 'Update';
    const statusLablel = status.toUpperCase();
    const priorityLabel = priority !== null ? `with ${priority}` : 'without';

    this._logger.groupCollapsed(
      `${titleLablel} #${profile.id} ${statusLablel} ${priorityLabel} priority in %c${updateMeasurement.duration}ms`,
      DURATION_STYLE,
    );

    if (renderMeasurement !== null) {
      this._logger.log(
        `%cRENDER PHASE:%c ${componentMeasurements.length} component(s) rendered in %c${renderMeasurement.duration}ms`,
        RENDER_PHASE_STYLE,
        DEFAULT_STYLE,
        DURATION_STYLE,
      );
      if (componentMeasurements.length > 0) {
        this._logger.table(componentMeasurements, ['name', 'duration']);
      }
    }

    if (commitMeasurement !== null) {
      this._logger.log(
        `%cCOMMIT PHASE:%c ${commitMeasurement.committedEffects} effect(s) committed in %c${commitMeasurement.duration}ms`,
        COMMIT_PHASE_STYLE,
        DEFAULT_STYLE,
        DURATION_STYLE,
      );
    }

    if (mutationMeasurement !== null) {
      this._logger.log(
        `%cMUTATION PHASE:%c ${mutationMeasurement.committedEffects} effect(s) committed in %c${mutationMeasurement.duration}ms`,
        MUTATION_PHASE_STYLE,
        DEFAULT_STYLE,
        DURATION_STYLE,
      );
    }

    if (layoutMeasurement !== null) {
      this._logger.log(
        `%cLAYOUT PHASE:%c ${layoutMeasurement.committedEffects} effect(s) committed in %c${layoutMeasurement.duration}ms`,
        LAYOUT_PHASE_STYLE,
        DEFAULT_STYLE,
        DURATION_STYLE,
      );
    }

    if (passiveMeasurement !== null) {
      this._logger.log(
        `%cPASSIVE PHASE:%c ${passiveMeasurement.committedEffects} effect(s) committed in %c${passiveMeasurement.duration}ms`,
        PASSIVE_PHASE_STYLE,
        DEFAULT_STYLE,
        DURATION_STYLE,
      );
    }

    this._logger.groupEnd();
  }
}

function createProfile(id: number): RuntimeProfile {
  return {
    id,
    status: 'pending',
    phase: 'idle',
    updateMeasurement: null,
    renderMeasurement: null,
    componentMeasurements: [],
    commitMeasurement: null,
    mutationMeasurement: null,
    layoutMeasurement: null,
    passiveMeasurement: null,
  };
}
