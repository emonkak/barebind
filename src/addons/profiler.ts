/// <reference path="../../typings/scheduler.d.ts" />

import {
  CommitPhase,
  getPriorityFromLanes,
  Lane,
  type Lanes,
} from '../internal.js';
import type { RuntimeEvent, RuntimeObserver } from '../runtime.js';

export interface PerformanceProfile {
  id: number;
  updateMeasurement: UpdateMeasurement | null;
  renderMeasurement: RenderMeasurement | null;
  componentMeasurements: ComponentMeasurement[];
  mutationMeasurement: CommitMeasurement | null;
  layoutMeasurement: CommitMeasurement | null;
  passiveMeasurement: CommitMeasurement | null;
}

export interface UpdateMeasurement {
  success: boolean;
  startTime: number;
  duration: number;
  lanes: Lanes;
}

export interface RenderMeasurement {
  startTime: number;
  duration: number;
}

export interface ComponentMeasurement {
  name: string;
  startTime: number;
  duration: number;
}

export interface CommitMeasurement {
  startTime: number;
  duration: number;
  totalEffects: number;
}

export interface PerformanceReporter {
  reportProfile(profile: PerformanceProfile): void;
}

export type ConsoleLogger = Pick<
  Console,
  'group' | 'groupCollapsed' | 'groupEnd' | 'log' | 'table'
>;

// Blue
const RENDER_PHASE_STYLE =
  'color: light-dark(#0b57d0, #4c8df6); font-weight: bold';
// Orange
const MUTATION_PHASE_STYLE =
  'color: light-dark(#9F4312, #E96725); font-weight: bold';
// Purple
const LAYOUT_PHASE_STYLE =
  'color: light-dark(#8c1ed3, #bf67ff); font-weight: bold';
// Green
const PASSIVE_PHASE_STYLE =
  'color: light-dark(#146c2e, #1ea446); font-weight: bold';
const DURATION_STYLE =
  'color: light-dark(#5e5d67, #918f9a); font-weight: normal';
const DEFAULT_STYLE = 'font-weight: normal';

export class PerformanceProfiler implements RuntimeObserver {
  private readonly _reporter: PerformanceReporter;

  private readonly _inProgressProfiles: Map<number, PerformanceProfile> =
    new Map();

  constructor(reporter: PerformanceReporter) {
    this._reporter = reporter;
  }

  onRuntimeEvent(event: RuntimeEvent): void {
    let profile = this._inProgressProfiles.get(event.id);

    if (profile === undefined) {
      profile = createProfile(event.id);
      this._inProgressProfiles.set(event.id, profile);
    }

    switch (event.type) {
      case 'UPDATE_START': {
        profile.updateMeasurement = {
          success: false,
          startTime: performance.now(),
          duration: 0,
          lanes: event.lanes,
        };
        break;
      }
      case 'UPDATE_SUCCESS':
      case 'UPDATE_FAILURE': {
        const measurement = profile.updateMeasurement;
        if (measurement !== null) {
          measurement.success = event.type === 'UPDATE_SUCCESS';
          measurement.duration = performance.now() - measurement.startTime;
        }
        this._reporter.reportProfile(profile);
        this._inProgressProfiles.delete(event.id);
        break;
      }
      case 'RENDER_START':
        profile.renderMeasurement = {
          startTime: performance.now(),
          duration: 0,
        };
        break;
      case 'RENDER_END': {
        const measurement = profile.renderMeasurement;
        if (measurement !== null) {
          measurement.duration = performance.now() - measurement.startTime;
        }
        break;
      }
      case 'COMPONENT_RENDER_START': {
        profile.componentMeasurements.push({
          name: event.component.name,
          startTime: performance.now(),
          duration: 0,
        });
        break;
      }
      case 'COMPONENT_RENDER_END': {
        const measurement = profile.componentMeasurements.at(-1);
        if (measurement !== undefined) {
          measurement.duration = performance.now() - measurement.startTime;
        }
        break;
      }
      case 'COMMIT_START':
        {
          const measurement = {
            startTime: performance.now(),
            duration: 0,
            totalEffects: event.effects.length,
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
        }
        break;
      case 'COMMIT_END': {
        let measurement: CommitMeasurement | null = null;
        switch (event.phase) {
          case CommitPhase.Mutation: {
            measurement = profile.mutationMeasurement;
            break;
          }
          case CommitPhase.Layout: {
            measurement = profile.layoutMeasurement;
            break;
          }
          case CommitPhase.Passive: {
            measurement = profile.passiveMeasurement;
            break;
          }
        }
        if (measurement !== null) {
          measurement.duration = performance.now() - measurement.startTime;
        }
        break;
      }
    }
  }
}

export class ConsoleReporter implements PerformanceReporter {
  private readonly _logger: ConsoleLogger;

  constructor(logger: ConsoleLogger = console) {
    this._logger = logger;
  }

  reportProfile(profile: PerformanceProfile): void {
    const {
      updateMeasurement,
      renderMeasurement,
      componentMeasurements,
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
    const statusLablel = updateMeasurement.success ? 'Success' : 'FAILURE';
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

    if (mutationMeasurement !== null) {
      this._logger.log(
        `%cMUTATION PHASE:%c ${mutationMeasurement.totalEffects} effect(s) committed in %c${mutationMeasurement.duration}ms`,
        MUTATION_PHASE_STYLE,
        DEFAULT_STYLE,
        DURATION_STYLE,
      );
    }

    if (layoutMeasurement !== null) {
      this._logger.log(
        `%cLAYOUT PHASE:%c ${layoutMeasurement.totalEffects} effect(s) committed in %c${layoutMeasurement.duration}ms`,
        LAYOUT_PHASE_STYLE,
        DEFAULT_STYLE,
        DURATION_STYLE,
      );
    }

    if (passiveMeasurement !== null) {
      this._logger.log(
        `%cPASSIVE PHASE:%c ${passiveMeasurement.totalEffects} effect(s) committed in %c${passiveMeasurement.duration}ms`,
        PASSIVE_PHASE_STYLE,
        DEFAULT_STYLE,
        DURATION_STYLE,
      );
    }

    this._logger.groupEnd();
  }
}

function createProfile(id: number): PerformanceProfile {
  return {
    id,
    updateMeasurement: null,
    renderMeasurement: null,
    componentMeasurements: [],
    mutationMeasurement: null,
    layoutMeasurement: null,
    passiveMeasurement: null,
  };
}
