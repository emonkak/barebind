import { describe, expect, it, vi } from 'vitest';

import {
  type ConsoleLogger,
  ConsoleReporter,
  type SessionProfile,
  SessionProfiler,
} from '@/addons/session-profiler.js';
import { createComponent } from '@/component.js';
import { Lane, type RenderContext, type SessionEvent } from '@/core.js';
import { RecoverableError } from '@/error.js';
import { createEffectQueue, MockCoroutine, MockEffect } from '../../mocks.js';

describe('SessionProfiler', () => {
  describe('onSessionEvent()', () => {
    it('reports profiles with succeeded status when update succeeds', () => {
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
      const events: SessionEvent[] = [
        {
          type: 'render-start',
          id: 0,
          lanes: Lane.ConcurrentLane,
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
          lanes: Lane.ConcurrentLane,
        },
        {
          type: 'commit-start',
          id: 0,
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
          effects: mutationEffects,
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
          effects: layoutEffects,
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
          effects: passiveEffects,
        },
        {
          type: 'commit-end',
          id: 0,
        },
      ];

      for (const event of events) {
        profiler.onSessionEvent(event);
      }

      expect(reporter.reportProfile).toHaveBeenCalledOnce();
      expect(reporter.reportProfile).toHaveBeenCalledWith({
        id: 0,
        status: 'succeeded',
        phase: 'postcommit',
        renderMeasurement: {
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          lanes: Lane.ConcurrentLane,
        },
        commitMeasurement: {
          startTime: expect.any(Number),
          endTime: expect.any(Number),
        },
        errorRecords: [],
        componentRecords: [
          {
            name: 'MyComponent',
            startTime: expect.any(Number),
            endTime: expect.any(Number),
          },
        ],
        effectRecords: [
          {
            phase: 'mutation',
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            effectCount: 2,
          },
          {
            phase: 'layout',
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            effectCount: 1,
          },
          {
            phase: 'passive',
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            effectCount: 1,
          },
        ],
      } satisfies SessionProfile);
    });

    it('reports profiles with succeeded status when transition fails', () => {
      const reporter = {
        reportProfile: vi.fn(),
      };
      const profiler = new SessionProfiler(reporter);

      const error = new RecoverableError(new MockCoroutine());
      const events: SessionEvent[] = [
        {
          type: 'render-start',
          id: 0,
          lanes: Lane.ConcurrentLane,
        },
        {
          type: 'render-end',
          id: 0,
          lanes: Lane.ConcurrentLane,
        },
        {
          type: 'commit-abort',
          id: 0,
          reason: error,
        },
      ];

      for (const event of events) {
        profiler.onSessionEvent(event);
      }

      expect(reporter.reportProfile).toHaveBeenCalledOnce();
      expect(reporter.reportProfile).toHaveBeenCalledWith({
        id: 0,
        status: 'interrupted',
        phase: 'postcommit',
        renderMeasurement: {
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          lanes: Lane.ConcurrentLane,
        },
        commitMeasurement: null,
        errorRecords: [],
        componentRecords: [],
        effectRecords: [],
      } satisfies SessionProfile);
    });

    it('reports profiles with failed status when update fails', () => {
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
          type: 'render-start',
          id: 0,
          lanes: Lane.UserBlockingLane,
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
          lanes: Lane.UserBlockingLane,
        },
        {
          type: 'commit-abort',
          id: 0,
          reason: error,
        },
      ];

      for (const event of events) {
        profiler.onSessionEvent(event);
      }

      expect(reporter.reportProfile).toHaveBeenCalledOnce();
      expect(reporter.reportProfile).toHaveBeenCalledWith({
        id: 0,
        status: 'failed',
        phase: 'postcommit',
        renderMeasurement: {
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          lanes: Lane.UserBlockingLane,
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
            endTime: expect.any(Number),
          },
        ],
        effectRecords: [],
      } satisfies SessionProfile);
    });

    it('reports profiles with interrupted status when update interrupts', () => {
      const reporter = {
        reportProfile: vi.fn(),
      };
      const profiler = new SessionProfiler(reporter);

      const component = createComponent(function MyComponent(_props: {}) {
        return null;
      });
      const error = new RecoverableError(new MockCoroutine());
      const events: SessionEvent[] = [
        {
          type: 'render-start',
          id: 0,
          lanes: Lane.ConcurrentLane,
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
          lanes: Lane.ConcurrentLane,
        },
        {
          type: 'commit-abort',
          id: 0,
          reason: error,
        },
      ];

      for (const event of events) {
        profiler.onSessionEvent(event);
      }

      expect(reporter.reportProfile).toHaveBeenCalledOnce();
      expect(reporter.reportProfile).toHaveBeenCalledWith({
        id: 0,
        status: 'interrupted',
        phase: 'postcommit',
        renderMeasurement: {
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          lanes: Lane.ConcurrentLane,
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
            endTime: expect.any(Number),
          },
        ],
        effectRecords: [],
      } satisfies SessionProfile);
    });

    it('reports profiles after deferred commit phase ends', () => {
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
      const passiveEffects = createEffectQueue([new MockEffect()]);
      const events: SessionEvent[] = [
        {
          type: 'render-start',
          id: 0,
          lanes: Lane.ConcurrentLane,
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
          lanes: Lane.UserBlockingLane,
        },
        {
          type: 'commit-start',
          id: 0,
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
          effects: mutationEffects,
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
          effects: passiveEffects,
        },
        {
          type: 'commit-end',
          id: 0,
        },
      ];

      for (const event of events) {
        profiler.onSessionEvent(event);
      }

      expect(reporter.reportProfile).toHaveBeenCalledOnce();
      expect(reporter.reportProfile).toHaveBeenCalledWith({
        id: 0,
        status: 'succeeded',
        phase: 'postcommit',
        renderMeasurement: {
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          lanes: Lane.ConcurrentLane,
        },
        commitMeasurement: {
          startTime: expect.any(Number),
          endTime: expect.any(Number),
        },
        errorRecords: [],
        componentRecords: [
          {
            name: 'MyComponent',
            startTime: expect.any(Number),
            endTime: expect.any(Number),
          },
        ],
        effectRecords: [
          {
            phase: 'mutation',
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            effectCount: 2,
          },
          {
            phase: 'passive',
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            effectCount: 1,
          },
        ],
      } satisfies SessionProfile);
    });

    it('reports profiles after deferred passive effects commit', () => {
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
      const passiveEffects = createEffectQueue([new MockEffect()]);
      const events: SessionEvent[] = [
        {
          type: 'render-start',
          id: 0,
          lanes: Lane.ConcurrentLane,
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
          lanes: Lane.ConcurrentLane,
        },
        {
          type: 'commit-start',
          id: 0,
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
          effects: mutationEffects,
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
          effects: passiveEffects,
        },
        {
          type: 'commit-end',
          id: 0,
        },
      ];

      for (const event of events) {
        profiler.onSessionEvent(event);
      }

      expect(reporter.reportProfile).toHaveBeenCalledOnce();
      expect(reporter.reportProfile).toHaveBeenCalledWith({
        id: 0,
        status: 'succeeded',
        phase: 'postcommit',
        renderMeasurement: {
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          lanes: Lane.ConcurrentLane,
        },
        commitMeasurement: {
          startTime: expect.any(Number),
          endTime: expect.any(Number),
        },
        errorRecords: [],
        componentRecords: [
          {
            name: 'MyComponent',
            startTime: expect.any(Number),
            endTime: expect.any(Number),
          },
        ],
        effectRecords: [
          {
            phase: 'mutation',
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            effectCount: 2,
          },
          {
            phase: 'passive',
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            effectCount: 1,
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
          type: 'render-end',
          id: 0,
          lanes: Lane.ConcurrentLane,
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
        renderMeasurement: null,
        commitMeasurement: null,
        errorRecords: [],
        componentRecords: [],
        effectRecords: [],
      });

      expect(logger.flush()).toStrictEqual([
        [
          'groupCollapsed',
          '#0 Update PENDING without priority in no mode after %c0ms',
        ],
        ['groupEnd'],
      ]);
    });

    it('reports the update as a transition and a view transition when lanes contains TransitionLane and ViewTransitionLane', () => {
      reporter.reportProfile({
        id: 0,
        phase: 'prerender',
        status: 'succeeded',
        renderMeasurement: {
          startTime: 0,
          endTime: 10,
          lanes:
            Lane.ConcurrentLane | Lane.TransitionLane | Lane.ViewTransitionLane,
        },
        commitMeasurement: null,
        errorRecords: [],
        componentRecords: [],
        effectRecords: [],
      });

      expect(logger.flush()).toStrictEqual([
        [
          'groupCollapsed',
          '#0 Transition/ViewTransition SUCCEEDED without priority in concurrent mode after %c10ms',
        ],
        ['group', '%cRENDER PHASE:%c 0 component(s) rendered after %c10ms'],
        ['groupEnd'],
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
        phase: 'prerender',
        status: 'succeeded',
        renderMeasurement: {
          startTime: 0,
          endTime: 10,
          lanes,
        },
        commitMeasurement: null,
        errorRecords: [],
        componentRecords: [],
        effectRecords: [],
      });

      expect(logger.flush()).toStrictEqual([
        [
          'groupCollapsed',
          `#0 Update SUCCEEDED with ${expectedPriority} priority in concurrent mode after %c10ms`,
        ],
        ['group', '%cRENDER PHASE:%c 0 component(s) rendered after %c10ms'],
        ['groupEnd'],
        ['groupEnd'],
      ]);
    });

    it.each([
      [Lane.ConcurrentLane, 'concurrent'],
      [Lane.SyncLane, 'sync'],
      [Lane.NoLane, 'no'],
    ])('reports the mode when lanes contains a mode lane', (lanes, expectedMode) => {
      reporter.reportProfile({
        id: 0,
        phase: 'prerender',
        status: 'succeeded',
        renderMeasurement: {
          startTime: 0,
          endTime: 10,
          lanes,
        },
        commitMeasurement: null,
        errorRecords: [],
        componentRecords: [],
        effectRecords: [],
      });

      expect(logger.flush()).toStrictEqual([
        [
          'groupCollapsed',
          `#0 Update SUCCEEDED without priority in ${expectedMode} mode after %c10ms`,
        ],
        ['group', '%cRENDER PHASE:%c 0 component(s) rendered after %c10ms'],
        ['groupEnd'],
        ['groupEnd'],
      ]);
    });

    it('reports component records when render is measured', () => {
      const profile: SessionProfile = {
        id: 0,
        phase: 'prerender',
        status: 'succeeded',
        renderMeasurement: {
          startTime: 0,
          endTime: 10,
          lanes: Lane.ConcurrentLane,
        },
        commitMeasurement: null,
        errorRecords: [],
        componentRecords: [
          {
            name: 'Foo',
            startTime: 0,
            endTime: 1,
          },
          {
            name: 'Bar',
            startTime: 1,
            endTime: 2,
          },
        ],
        effectRecords: [],
      };

      reporter.reportProfile(profile);

      expect(logger.flush()).toStrictEqual([
        [
          'groupCollapsed',
          `#0 Update SUCCEEDED without priority in concurrent mode after %c10ms`,
        ],
        ['group', '%cRENDER PHASE:%c 2 component(s) rendered after %c10ms'],
        [
          'table',
          profile.componentRecords.map(({ name, startTime, endTime }) => ({
            name,
            duration: Math.max(0, endTime - startTime),
          })),
        ],
        ['groupEnd'],
        ['groupEnd'],
      ]);
    });

    it('reports error records when render is measured', () => {
      const error = new Error('fail');
      const profile: SessionProfile = {
        id: 0,
        phase: 'prerender',
        status: 'failed',
        renderMeasurement: {
          startTime: 0,
          endTime: 10,
          lanes: Lane.ConcurrentLane,
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
          `#0 Update FAILED without priority in concurrent mode after %c10ms`,
        ],
        ['group', '%cRENDER PHASE:%c 0 component(s) rendered after %c10ms'],
        ['table', profile.errorRecords],
        ['groupEnd'],
        ['groupEnd'],
      ]);
    });

    it('reports effect records when commit is measured', () => {
      const profile: SessionProfile = {
        id: 0,
        phase: 'prerender',
        status: 'succeeded',
        renderMeasurement: null,
        commitMeasurement: {
          startTime: 0,
          endTime: 3,
        },
        errorRecords: [],
        componentRecords: [],
        effectRecords: [
          {
            phase: 'mutation',
            startTime: 3,
            endTime: 6,
            effectCount: 3,
          },
          {
            phase: 'layout',
            startTime: 6,
            endTime: 8,
            effectCount: 2,
          },
          {
            phase: 'passive',
            startTime: 8,
            endTime: 9,
            effectCount: 1,
          },
        ],
      };

      reporter.reportProfile(profile);

      expect(logger.flush()).toStrictEqual([
        [
          'groupCollapsed',
          `#0 Update SUCCEEDED without priority in no mode after %c3ms`,
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
