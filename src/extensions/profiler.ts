/// <reference path="../../typings/scheduler.d.ts" />

import { CommitPhase } from '../renderHost.js';
import type { RuntimeEvent, RuntimeObserver } from '../runtime.js';

export interface Profile {
  id: number;
  componentMeasurements: ComponentMeasurement[];
  priority: TaskPriority | null;
  viewTransition: boolean;
  updateStart: number;
  updateDuration: number;
  renderStart: number;
  renderDuration: number;
  mutationStart: number;
  mutationDuration: number;
  layoutStart: number;
  layoutDuration: number;
  passiveStart: number;
  passiveDuration: number;
  totalPassiveEffects: number;
  totalMutatationEffects: number;
  totalLayoutEffects: number;
}

export interface Reporter {
  reportProfile(profile: Profile): void;
}

export interface ComponentMeasurement {
  name: string;
  renderStart: number;
  renderDuration: number;
}

const RENDER_PHASE_STYLE =
  'color: light-dark(#0b57d0, #4c8df6); font-weight: bold';
const MUTATION_PHASE_STYLE =
  'color: light-dark(#b3261e, #e46962); font-weight: bold';
const LAYOUT_PHASE_STYLE =
  'color: light-dark(#8c1ed3, #bf67ff); font-weight: bold';
const PASSIVE_PHASE_STYLE =
  'color: light-dark(#146c2e, #1ea446); font-weight: bold';
const DURATION_STYLE =
  'color: light-dark(#5e5d67, #918f9a); font-weight: normal';
const DEFAULT_STYLE = 'font-weight: normal';

export class Profiler implements RuntimeObserver {
  private readonly _reporter: Reporter;

  private readonly _inProgressProfiles: Map<number, Profile> = new Map();

  constructor(reporter: Reporter) {
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
        const { priority, viewTransition } = event.options;
        profile.priority = priority ?? null;
        profile.viewTransition = viewTransition ?? false;
        profile.updateStart = performance.now();
        break;
      }
      case 'UPDATE_END': {
        profile.updateDuration = performance.now() - profile.updateStart;
        this._reporter.reportProfile(profile);
        this._inProgressProfiles.delete(event.id);
        break;
      }
      case 'RENDER_START':
        profile.renderStart = performance.now();
        break;
      case 'RENDER_END':
        profile.renderDuration = performance.now() - profile.renderStart;
        break;
      case 'COMMIT_START':
        switch (event.phase) {
          case CommitPhase.Mutation:
            profile.mutationStart = performance.now();
            break;
          case CommitPhase.Layout:
            profile.layoutStart = performance.now();
            break;
          case CommitPhase.Passive:
            profile.passiveStart = performance.now();
            break;
        }
        break;
      case 'COMMIT_END':
        switch (event.phase) {
          case CommitPhase.Mutation:
            profile.mutationDuration =
              performance.now() - profile.mutationStart;
            profile.totalMutatationEffects += event.effects.length;
            break;
          case CommitPhase.Layout:
            profile.layoutDuration = performance.now() - profile.layoutStart;
            profile.totalLayoutEffects += event.effects.length;
            break;
          case CommitPhase.Passive:
            profile.passiveDuration = performance.now() - profile.passiveStart;
            profile.totalPassiveEffects += event.effects.length;
            break;
        }
        break;
      case 'COMPONENT_RENDER_START': {
        const measurement: ComponentMeasurement = {
          name: event.component.name,
          renderStart: performance.now(),
          renderDuration: 0,
        };
        profile.componentMeasurements.push(measurement);
        break;
      }
      case 'COMPONENT_RENDER_END': {
        const measurement = profile.componentMeasurements.at(-1);
        if (measurement !== undefined) {
          measurement.renderDuration =
            performance.now() - measurement.renderStart;
        }
        break;
      }
    }
  }
}

export class ConsoleReporter implements Reporter {
  private readonly _logger: Console;

  constructor(logger: Console = console) {
    this._logger = logger;
  }

  reportProfile(profile: Profile): void {
    const titleLablel = profile.viewTransition ? 'View transition' : 'Update';
    const priorityLabel =
      profile.priority !== null
        ? `with ${profile.priority} priority`
        : 'without priority';
    console.group(
      `${titleLablel} #${profile.id} ${priorityLabel} in %c${profile.updateDuration}ms`,
      DURATION_STYLE,
    );
    if (profile.componentMeasurements.length > 0) {
      this._logger.group(
        `%cRENDER PHASE:%c ${profile.componentMeasurements.length} component(s) rendered in %c${profile.renderDuration}ms`,
        RENDER_PHASE_STYLE,
        DEFAULT_STYLE,
        DURATION_STYLE,
      );
      this._logger.table(profile.componentMeasurements, [
        'name',
        'renderDuration',
      ]);
      this._logger.groupEnd();
    } else {
      this._logger.log(
        `%cRENDER PHASE:%c No components rendered in %c${profile.renderDuration}ms`,
        RENDER_PHASE_STYLE,
        DEFAULT_STYLE,
        DURATION_STYLE,
      );
    }
    if (profile.totalMutatationEffects > 0) {
      this._logger.log(
        `%cMUTATION PHASE:%c ${profile.totalMutatationEffects} effect(s) committed in %c${profile.mutationDuration}ms`,
        MUTATION_PHASE_STYLE,
        DEFAULT_STYLE,
        DURATION_STYLE,
      );
    }
    if (profile.totalLayoutEffects > 0) {
      this._logger.log(
        `%cLAYOUT PHASE:%c ${profile.totalLayoutEffects} effect(s) committed in %c${profile.layoutDuration}ms`,
        LAYOUT_PHASE_STYLE,
        DEFAULT_STYLE,
        DURATION_STYLE,
      );
    }
    if (profile.totalPassiveEffects > 0) {
      this._logger.log(
        `%cPASSIVE PHASE:%c ${profile.totalPassiveEffects} effect(s) committed in %c${profile.passiveDuration}ms`,
        PASSIVE_PHASE_STYLE,
        DEFAULT_STYLE,
        DURATION_STYLE,
      );
    }
    this._logger.groupEnd();
  }
}

function createProfile(id: number): Profile {
  return {
    id,
    componentMeasurements: [],
    priority: null,
    viewTransition: false,
    updateStart: 0,
    updateDuration: 0,
    renderStart: 0,
    renderDuration: 0,
    mutationStart: 0,
    mutationDuration: 0,
    layoutStart: 0,
    layoutDuration: 0,
    passiveStart: 0,
    passiveDuration: 0,
    totalPassiveEffects: 0,
    totalMutatationEffects: 0,
    totalLayoutEffects: 0,
  };
}
