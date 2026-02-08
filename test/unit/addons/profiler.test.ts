import { describe, expect, it, vi } from 'vitest';

import {
  type ConsoleLogger,
  ConsoleReporter,
  type PerformanceProfile,
  PerformanceProfiler,
} from '@/addons/profiler.js';
import { createComponent } from '@/component.js';
import { CommitPhase, Lane, type RenderContext } from '@/internal.js';
import type { RuntimeEvent } from '@/runtime.js';
import { createEffectQueue, MockEffect } from '../../mocks.js';

describe('PerformanceProfiler', () => {
  describe('onRuntimeEvent()', () => {
    it('reports the profile on update success', () => {
      const reporter = {
        reportProfile: vi.fn(),
      };
      const profiler = new PerformanceProfiler(reporter);

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
      const events: RuntimeEvent[] = [
        {
          type: 'update-start',
          id: 0,
          lanes: Lane.UserBlockingLane,
        },
        {
          type: 'render-phase-start',
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
          type: 'render-phase-end',
          id: 0,
        },
        {
          type: 'commit-phase-start',
          id: 0,
          mutationEffects,
          layoutEffects,
          passiveEffects,
        },
        {
          type: 'effect-commit-start',
          id: 0,
          phase: CommitPhase.Mutation,
          effects: mutationEffects,
        },
        {
          type: 'effect-commit-end',
          id: 0,
          phase: CommitPhase.Mutation,
          effects: emptyEffects,
        },
        {
          type: 'effect-commit-start',
          id: 0,
          phase: CommitPhase.Layout,
          effects: layoutEffects,
        },
        {
          type: 'effect-commit-end',
          id: 0,
          phase: CommitPhase.Layout,
          effects: emptyEffects,
        },
        {
          type: 'effect-commit-start',
          id: 0,
          phase: CommitPhase.Passive,
          effects: passiveEffects,
        },
        {
          type: 'effect-commit-end',
          id: 0,
          phase: CommitPhase.Passive,
          effects: emptyEffects,
        },
        {
          type: 'commit-phase-end',
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
        profiler.onRuntimeEvent(event);
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
        componentMeasurements: [
          {
            name: 'MyComponent',
            startTime: expect.any(Number),
            duration: expect.any(Number),
          },
        ],
        commitMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
          pendingEffects: 0,
          committedEffects: 4,
        },
        mutationMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
          pendingEffects: 0,
          committedEffects: 2,
        },
        layoutMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
          pendingEffects: 0,
          committedEffects: 1,
        },
        passiveMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
          pendingEffects: 0,
          committedEffects: 1,
        },
      } satisfies PerformanceProfile);
    });

    it('reports the profile on update failure', () => {
      const reporter = {
        reportProfile: vi.fn(),
      };
      const profiler = new PerformanceProfiler(reporter);

      const component = createComponent(function MyComponent(_props: {}) {
        return null;
      });
      const error = new Error('fail');
      const events: RuntimeEvent[] = [
        {
          type: 'update-start',
          id: 0,
          lanes: Lane.UserBlockingLane,
        },
        {
          type: 'render-phase-start',
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
          type: 'update-failure',
          id: 0,
          lanes: Lane.UserBlockingLane,
          error,
        },
      ];

      for (const event of events) {
        profiler.onRuntimeEvent(event);
      }

      expect(reporter.reportProfile).toHaveBeenCalledOnce();
      expect(reporter.reportProfile).toHaveBeenCalledWith({
        id: 0,
        status: 'failure',
        phase: 'render',
        updateMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
          lanes: Lane.UserBlockingLane,
        },
        renderMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
        },
        componentMeasurements: [
          {
            name: 'MyComponent',
            startTime: expect.any(Number),
            duration: expect.any(Number),
          },
        ],
        commitMeasurement: null,
        mutationMeasurement: null,
        layoutMeasurement: null,
        passiveMeasurement: null,
      } satisfies PerformanceProfile);
    });

    it('reports the profile after all effects are committed', () => {
      const reporter = {
        reportProfile: vi.fn(),
      };
      const profiler = new PerformanceProfiler(reporter);

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
      const events: RuntimeEvent[] = [
        {
          type: 'update-start',
          id: 0,
          lanes: Lane.UserBlockingLane,
        },
        {
          type: 'render-phase-start',
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
          type: 'render-phase-end',
          id: 0,
        },
        {
          type: 'commit-phase-start',
          id: 0,
          mutationEffects,
          layoutEffects,
          passiveEffects,
        },
        {
          type: 'effect-commit-start',
          id: 0,
          phase: CommitPhase.Mutation,
          effects: mutationEffects,
        },
        {
          type: 'effect-commit-end',
          id: 0,
          phase: CommitPhase.Mutation,
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
          phase: CommitPhase.Passive,
          effects: passiveEffects,
        },
        {
          type: 'effect-commit-end',
          id: 0,
          phase: CommitPhase.Passive,
          effects: emptyEffects,
        },
        {
          type: 'commit-phase-end',
          id: 0,
          mutationEffects: emptyEffects,
          layoutEffects: emptyEffects,
          passiveEffects: emptyEffects,
        },
      ];

      for (const event of events) {
        profiler.onRuntimeEvent(event);
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
        componentMeasurements: [
          {
            name: 'MyComponent',
            startTime: expect.any(Number),
            duration: expect.any(Number),
          },
        ],
        commitMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
          pendingEffects: 0,
          committedEffects: 3,
        },
        mutationMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
          pendingEffects: 0,
          committedEffects: 2,
        },
        layoutMeasurement: null,
        passiveMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
          pendingEffects: 0,
          committedEffects: 1,
        },
      } satisfies PerformanceProfile);
    });

    it('ignore events for updates that have not started', () => {
      const reporter = {
        reportProfile: vi.fn(),
      };
      const profiler = new PerformanceProfiler(reporter);

      const events: RuntimeEvent[] = [
        {
          type: 'update-success',
          id: 0,
          lanes: Lane.UserBlockingLane,
        },
      ];

      for (const event of events) {
        profiler.onRuntimeEvent(event);
      }

      expect(reporter.reportProfile).not.toHaveBeenCalledOnce();
    });
  });
});

describe('ConsoleReporter', () => {
  describe('reportProfile()', () => {
    it.each([
      [
        {
          id: 0,
          status: 'pending',
          phase: 'idle',
          updateMeasurement: null,
          renderMeasurement: null,
          componentMeasurements: [],
          commitMeasurement: null,
          mutationMeasurement: null,
          layoutMeasurement: null,
          passiveMeasurement: null,
        },
        [],
      ],
      [
        {
          id: 0,
          status: 'success',
          phase: 'idle',
          updateMeasurement: {
            startTime: 0,
            duration: 10,
            lanes: Lane.ViewTransitionLane,
          },
          renderMeasurement: null,
          componentMeasurements: [],
          commitMeasurement: null,
          mutationMeasurement: null,
          layoutMeasurement: null,
          passiveMeasurement: null,
        },
        [
          [
            'groupCollapsed',
            'Transition #0 SUCCESS without priority in %c10ms',
          ],
          ['groupEnd'],
        ],
      ],
      [
        {
          id: 0,
          status: 'success',
          phase: 'idle',
          updateMeasurement: {
            startTime: 0,
            duration: 10,
            lanes: Lane.UserBlockingLane,
          },
          renderMeasurement: {
            startTime: 0,
            duration: 4,
          },
          componentMeasurements: [
            {
              name: 'MyComponent',
              startTime: 0,
              duration: 4,
            },
          ],
          commitMeasurement: {
            startTime: 4,
            duration: 6,
            pendingEffects: 0,
            committedEffects: 6,
          },
          mutationMeasurement: {
            startTime: 4,
            duration: 3,
            pendingEffects: 0,
            committedEffects: 3,
          },
          layoutMeasurement: {
            startTime: 7,
            duration: 2,
            pendingEffects: 0,
            committedEffects: 2,
          },
          passiveMeasurement: {
            startTime: 9,
            duration: 1,
            pendingEffects: 0,
            committedEffects: 1,
          },
        },
        [
          [
            'groupCollapsed',
            'Update #0 SUCCESS with user-blocking priority in %c10ms',
          ],
          ['log', '%cRENDER PHASE:%c 1 component(s) rendered in %c4ms'],
          [
            'table',
            [
              {
                name: 'MyComponent',
                startTime: 0,
                duration: 4,
              },
            ],
          ],
          ['group', '%cCOMMIT PHASE:%c 6 effect(s) committed in %c6ms'],
          ['log', '%cMUTATION PHASE:%c 3 effect(s) committed in %c3ms'],
          ['log', '%cLAYOUT PHASE:%c 2 effect(s) committed in %c2ms'],
          ['log', '%cPASSIVE PHASE:%c 1 effect(s) committed in %c1ms'],
          ['groupEnd'],
          ['groupEnd'],
        ],
      ],
      [
        {
          id: 0,
          status: 'failure',
          phase: 'idle',
          updateMeasurement: {
            startTime: 0,
            duration: 10,
            lanes: Lane.UserBlockingLane,
          },
          renderMeasurement: {
            startTime: 0,
            duration: 0,
          },
          componentMeasurements: [
            {
              name: 'MyComponent',
              startTime: 0,
              duration: 0,
            },
          ],
          commitMeasurement: null,
          mutationMeasurement: null,
          layoutMeasurement: null,
          passiveMeasurement: null,
        },
        [
          [
            'groupCollapsed',
            'Update #0 FAILURE with user-blocking priority in %c10ms',
          ],
          ['log', '%cRENDER PHASE:%c 1 component(s) rendered in %c0ms'],
          [
            'table',
            [
              {
                name: 'MyComponent',
                startTime: 0,
                duration: 0,
              },
            ],
          ],
          ['groupEnd'],
        ],
      ],
    ] as const satisfies [
      PerformanceProfile,
      [keyof ConsoleLogger, ...unknown[]][],
    ][])('prints a profile to the logger', (profile, expectedLogs) => {
      const logger = new MockLogger();
      const reporter = new ConsoleReporter(logger);

      reporter.reportProfile(profile);

      expect(logger.flush()).toStrictEqual(expectedLogs);
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
