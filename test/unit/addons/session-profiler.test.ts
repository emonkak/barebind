import { describe, expect, it, vi } from 'vitest';

import {
  type ConsoleLogger,
  ConsoleReporter,
  type SessionProfile,
  SessionProfiler,
} from '@/addons/session-profiler.js';
import { createComponent } from '@/component.js';
import { Lane, type RenderContext, type SessionEvent } from '@/core.js';
import { createEffectQueue, MockEffect } from '../../mocks.js';

describe('SessionProfiler', () => {
  describe('onSessionEvent()', () => {
    it('flushs the profile when update is success', () => {
      const reporter = {
        reportProfile: vi.fn(),
      };
      const profiler = new SessionProfiler(reporter);

      const component = createComponent(function MyComponent(_props: {}) {
        return null;
      });
      const mutationEffects = createEffectQueue([
        new MockEffect(),
        new MockEffect(),
      ]);
      const layoutEffects = createEffectQueue([new MockEffect()]);
      const passiveEffects = createEffectQueue([new MockEffect()]);
      const emptyEffects = createEffectQueue([]);
      const events: SessionEvent[] = [
        {
          type: 'update-start',
          id: 0,
          lanes: Lane.UserBlockingLane,
        },
        {
          type: 'render-start',
          id: 0,
        },
        {
          type: 'component-render-start',
          id: 0,
          component,
          props: {},
          context: {} as RenderContext,
        },
        {
          type: 'component-render-end',
          id: 0,
          component,
          props: {},
          context: {} as RenderContext,
        },
        {
          type: 'render-end',
          id: 0,
        },
        {
          type: 'commit-start',
          id: 0,
          mutationEffects,
          layoutEffects,
          passiveEffects,
        },
        {
          type: 'effect-commit-start',
          id: 0,
          phase: 'mutation',
          effects: mutationEffects,
        },
        {
          type: 'effect-commit-end',
          id: 0,
          phase: 'mutation',
          effects: emptyEffects,
        },
        {
          type: 'effect-commit-start',
          id: 0,
          phase: 'layout',
          effects: layoutEffects,
        },
        {
          type: 'effect-commit-end',
          id: 0,
          phase: 'layout',
          effects: emptyEffects,
        },
        {
          type: 'effect-commit-start',
          id: 0,
          phase: 'passive',
          effects: passiveEffects,
        },
        {
          type: 'effect-commit-end',
          id: 0,
          phase: 'passive',
          effects: emptyEffects,
        },
        {
          type: 'commit-end',
          id: 0,
          mutationEffects: emptyEffects,
          layoutEffects: emptyEffects,
          passiveEffects: emptyEffects,
        },
        {
          type: 'update-success',
          id: 0,
          lanes: Lane.UserBlockingLane,
        },
      ];

      for (const event of events) {
        profiler.onSessionEvent(event);
      }

      expect(reporter.reportProfile).toHaveBeenCalledOnce();
      expect(reporter.reportProfile).toHaveBeenCalledWith({
        id: 0,
        status: 'success',
        phase: 'idle',
        updateMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
          lanes: Lane.UserBlockingLane,
        },
        renderMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
        },
        commitMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
        },
        errorRecords: [],
        componentRecords: [
          {
            name: 'MyComponent',
            startTime: expect.any(Number),
            duration: expect.any(Number),
          },
        ],
        effectRecords: [
          {
            phase: 'mutation',
            startTime: expect.any(Number),
            duration: expect.any(Number),
            pendingCount: 0,
            commitCount: 2,
          },
          {
            phase: 'layout',
            startTime: expect.any(Number),
            duration: expect.any(Number),
            pendingCount: 0,
            commitCount: 1,
          },
          {
            phase: 'passive',
            startTime: expect.any(Number),
            duration: expect.any(Number),
            pendingCount: 0,
            commitCount: 1,
          },
        ],
      } satisfies SessionProfile);
    });

    it('reports the profile when update is failure', () => {
      const reporter = {
        reportProfile: vi.fn(),
      };
      const profiler = new SessionProfiler(reporter);

      const component = createComponent(function MyComponent(_props: {}) {
        return null;
      });
      const error = new Error('fail');
      const events: SessionEvent[] = [
        {
          type: 'update-start',
          id: 0,
          lanes: Lane.UserBlockingLane,
        },
        {
          type: 'render-start',
          id: 0,
        },
        {
          type: 'component-render-start',
          id: 0,
          component,
          props: {},
          context: {} as RenderContext,
        },
        {
          type: 'render-error',
          id: 0,
          error,
          captured: false,
        },
        {
          type: 'render-end',
          id: 0,
        },
        {
          type: 'update-failure',
          id: 0,
          lanes: Lane.UserBlockingLane,
          error,
        },
      ];

      for (const event of events) {
        profiler.onSessionEvent(event);
      }

      expect(reporter.reportProfile).toHaveBeenCalledOnce();
      expect(reporter.reportProfile).toHaveBeenCalledWith({
        id: 0,
        status: 'failure',
        phase: 'idle',
        updateMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
          lanes: Lane.UserBlockingLane,
        },
        renderMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
        },
        commitMeasurement: null,
        errorRecords: [
          {
            error,
            captured: false,
          },
        ],
        componentRecords: [
          {
            name: 'MyComponent',
            startTime: expect.any(Number),
            duration: expect.any(Number),
          },
        ],
        effectRecords: [],
      } satisfies SessionProfile);
    });

    it('reports the profile after commit phase ends when passive effects are scheduled', () => {
      const reporter = {
        reportProfile: vi.fn(),
      };
      const profiler = new SessionProfiler(reporter);

      const component = createComponent(function MyComponent(_props: {}) {
        return null;
      });
      const mutationEffects = createEffectQueue([
        new MockEffect(),
        new MockEffect(),
      ]);
      const layoutEffects = createEffectQueue([]);
      const passiveEffects = createEffectQueue([new MockEffect()]);
      const emptyEffects = createEffectQueue([]);
      const events: SessionEvent[] = [
        {
          type: 'update-start',
          id: 0,
          lanes: Lane.UserBlockingLane,
        },
        {
          type: 'render-start',
          id: 0,
        },
        {
          type: 'component-render-start',
          id: 0,
          component,
          props: {},
          context: {} as RenderContext,
        },
        {
          type: 'component-render-end',
          id: 0,
          component,
          props: {},
          context: {} as RenderContext,
        },
        {
          type: 'render-end',
          id: 0,
        },
        {
          type: 'commit-start',
          id: 0,
          mutationEffects,
          layoutEffects,
          passiveEffects,
        },
        {
          type: 'effect-commit-start',
          id: 0,
          phase: 'mutation',
          effects: mutationEffects,
        },
        {
          type: 'effect-commit-end',
          id: 0,
          phase: 'mutation',
          effects: emptyEffects,
        },
        {
          type: 'update-success',
          id: 0,
          lanes: Lane.UserBlockingLane,
        },
        {
          type: 'effect-commit-start',
          id: 0,
          phase: 'passive',
          effects: passiveEffects,
        },
        {
          type: 'effect-commit-end',
          id: 0,
          phase: 'passive',
          effects: emptyEffects,
        },
        {
          type: 'commit-end',
          id: 0,
          mutationEffects: emptyEffects,
          layoutEffects: emptyEffects,
          passiveEffects: emptyEffects,
        },
      ];

      for (const event of events) {
        profiler.onSessionEvent(event);
      }

      expect(reporter.reportProfile).toHaveBeenCalledOnce();
      expect(reporter.reportProfile).toHaveBeenCalledWith({
        id: 0,
        status: 'success',
        phase: 'idle',
        updateMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
          lanes: Lane.UserBlockingLane,
        },
        renderMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
        },
        commitMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
        },
        errorRecords: [],
        componentRecords: [
          {
            name: 'MyComponent',
            startTime: expect.any(Number),
            duration: expect.any(Number),
          },
        ],
        effectRecords: [
          {
            phase: 'mutation',
            pendingCount: 0,
            commitCount: 2,
            startTime: expect.any(Number),
            duration: expect.any(Number),
          },
          {
            phase: 'passive',
            pendingCount: 0,
            commitCount: 1,
            startTime: expect.any(Number),
            duration: expect.any(Number),
          },
        ],
      } satisfies SessionProfile);
    });

    it('ignore events for updates that have not started', () => {
      const reporter = {
        reportProfile: vi.fn(),
      };
      const profiler = new SessionProfiler(reporter);

      const events: SessionEvent[] = [
        {
          type: 'update-success',
          id: 0,
          lanes: Lane.UserBlockingLane,
        },
      ];

      for (const event of events) {
        profiler.onSessionEvent(event);
      }

      expect(reporter.reportProfile).not.toHaveBeenCalledOnce();
    });
  });
});

describe('ConsoleReporter', () => {
  describe('reportProfile()', () => {
    const logger = new MockLogger();
    const reporter = new ConsoleReporter(logger);

    it('reports nothing when update has not started', () => {
      reporter.reportProfile({
        id: 0,
        phase: 'idle',
        status: 'pending',
        updateMeasurement: null,
        renderMeasurement: null,
        commitMeasurement: null,
        errorRecords: [],
        componentRecords: [],
        effectRecords: [],
      });

      expect(logger.flush()).toStrictEqual([]);
    });

    it('reports the update as a transition and a view transition when lanes contains TransitionLane and ViewTransitionLane', () => {
      reporter.reportProfile({
        id: 0,
        phase: 'idle',
        status: 'success',
        updateMeasurement: {
          startTime: 0,
          duration: 10,
          lanes:
            Lane.ConcurrentLane | Lane.TransitionLane | Lane.ViewTransitionLane,
        },
        renderMeasurement: null,
        commitMeasurement: null,
        errorRecords: [],
        componentRecords: [],
        effectRecords: [],
      });

      expect(logger.flush()).toStrictEqual([
        [
          'groupCollapsed',
          '#0 Transition/ViewTransition SUCCESS without priority in concurrent mode after %c10ms',
        ],
        ['groupEnd'],
      ]);
    });

    it.each([
      [Lane.ConcurrentLane | Lane.UserBlockingLane, 'user-blocking'],
      [Lane.ConcurrentLane | Lane.UserVisibleLane, 'user-visible'],
      [Lane.ConcurrentLane | Lane.BackgroundLane, 'background'],
    ])('reports the priority when lanes contains a priority lane', (lanes, expectedPriority) => {
      reporter.reportProfile({
        id: 0,
        phase: 'idle',
        status: 'success',
        updateMeasurement: {
          startTime: 0,
          duration: 10,
          lanes,
        },
        renderMeasurement: null,
        commitMeasurement: null,
        errorRecords: [],
        componentRecords: [],
        effectRecords: [],
      });

      expect(logger.flush()).toStrictEqual([
        [
          'groupCollapsed',
          `#0 Update SUCCESS with ${expectedPriority} priority in concurrent mode after %c10ms`,
        ],
        ['groupEnd'],
      ]);
    });

    it('reports the mode as sync mode when lanes contains SyncLane', () => {
      reporter.reportProfile({
        id: 0,
        phase: 'idle',
        status: 'success',
        updateMeasurement: {
          startTime: 0,
          duration: 10,
          lanes: Lane.ConcurrentLane | Lane.SyncLane,
        },
        renderMeasurement: null,
        commitMeasurement: null,
        errorRecords: [],
        componentRecords: [],
        effectRecords: [],
      });

      expect(logger.flush()).toStrictEqual([
        [
          'groupCollapsed',
          `#0 Update SUCCESS without priority in sync mode after %c10ms`,
        ],
        ['groupEnd'],
      ]);
    });

    it('reports component records when render is measured', () => {
      const profile: SessionProfile = {
        id: 0,
        phase: 'idle',
        status: 'success',
        updateMeasurement: {
          startTime: 0,
          duration: 10,
          lanes: Lane.ConcurrentLane,
        },
        renderMeasurement: {
          startTime: 0,
          duration: 3,
        },
        commitMeasurement: null,
        errorRecords: [],
        componentRecords: [
          {
            name: 'Foo',
            startTime: 0,
            duration: 1,
          },
          {
            name: 'Bar',
            startTime: 1,
            duration: 2,
          },
        ],
        effectRecords: [],
      };

      reporter.reportProfile(profile);

      expect(logger.flush()).toStrictEqual([
        [
          'groupCollapsed',
          `#0 Update SUCCESS without priority in concurrent mode after %c10ms`,
        ],
        ['group', '%cRENDER PHASE:%c 2 component(s) rendered after %c3ms'],
        ['table', profile.componentRecords],
        ['groupEnd'],
        ['groupEnd'],
      ]);
    });

    it('reports error records when render is measured', () => {
      const error = new Error('fail');
      const profile: SessionProfile = {
        id: 0,
        phase: 'idle',
        status: 'failure',
        updateMeasurement: {
          startTime: 0,
          duration: 10,
          lanes: Lane.ConcurrentLane,
        },
        renderMeasurement: {
          startTime: 0,
          duration: 3,
        },
        commitMeasurement: null,
        errorRecords: [
          {
            error,
            captured: true,
          },
        ],
        componentRecords: [],
        effectRecords: [],
      };

      reporter.reportProfile(profile);

      expect(logger.flush()).toStrictEqual([
        [
          'groupCollapsed',
          `#0 Update FAILURE without priority in concurrent mode after %c10ms`,
        ],
        ['group', '%cRENDER PHASE:%c 0 component(s) rendered after %c3ms'],
        ['table', profile.errorRecords],
        ['groupEnd'],
        ['groupEnd'],
      ]);
    });

    it('reports effect records when commit is measured', () => {
      const profile: SessionProfile = {
        id: 0,
        phase: 'idle',
        status: 'success',
        updateMeasurement: {
          startTime: 0,
          duration: 10,
          lanes: Lane.ConcurrentLane,
        },
        renderMeasurement: null,
        commitMeasurement: {
          startTime: 0,
          duration: 3,
        },
        errorRecords: [],
        componentRecords: [],
        effectRecords: [
          {
            phase: 'mutation',
            pendingCount: 0,
            commitCount: 3,
            startTime: 4,
            duration: 3,
          },
          {
            phase: 'layout',
            pendingCount: 0,
            commitCount: 2,
            startTime: 7,
            duration: 2,
          },
          {
            phase: 'passive',
            pendingCount: 0,
            commitCount: 1,
            startTime: 9,
            duration: 1,
          },
        ],
      };

      reporter.reportProfile(profile);

      expect(logger.flush()).toStrictEqual([
        [
          'groupCollapsed',
          `#0 Update SUCCESS without priority in concurrent mode after %c10ms`,
        ],
        ['group', '%cCOMMIT PHASE:%c 6 effect(s) committed after %c3ms'],
        ['log', '%cMUTATION PHASE:%c 3 effect(s) committed in %c3ms'],
        ['log', '%cLAYOUT PHASE:%c 2 effect(s) committed in %c2ms'],
        ['log', '%cPASSIVE PHASE:%c 1 effect(s) committed in %c1ms'],
        ['groupEnd'],
        ['groupEnd'],
      ]);
    });
  });
});

type Log = [keyof ConsoleLogger, ...unknown[]];

class MockLogger implements ConsoleLogger {
  logs: Log[] = [];

  flush(): Log[] {
    const logs = this.logs;
    this.logs = [];
    return logs;
  }

  group(...args: unknown[]): void {
    this.logs.push(['group', args[0]]);
  }

  groupCollapsed(...args: unknown[]): void {
    this.logs.push(['groupCollapsed', args[0]]);
  }

  groupEnd(): void {
    this.logs.push(['groupEnd']);
  }

  log(...args: unknown[]): void {
    this.logs.push(['log', args[0]]);
  }

  table(...args: unknown[]): void {
    this.logs.push(['table', args[0]]);
  }
}
