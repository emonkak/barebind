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
          type: 'UPDATE_START',
          id: 1,
          lanes: Lane.UserBlockingLane,
        },
        {
          type: 'RENDER_START',
          id: 1,
          mutationEffects,
          layoutEffects,
          passiveEffects,
        },
        {
          type: 'COMPONENT_RENDER_START',
          id: 1,
          component,
          props: {},
          context: {} as RenderContext,
        },
        {
          type: 'COMPONENT_RENDER_END',
          id: 1,
          component,
          props: {},
          context: {} as RenderContext,
        },
        {
          type: 'RENDER_END',
          id: 1,
          mutationEffects,
          layoutEffects,
          passiveEffects,
        },
        {
          type: 'COMMIT_START',
          id: 1,
          phase: CommitPhase.Mutation,
          effects: mutationEffects,
        },
        {
          type: 'COMMIT_END',
          id: 1,
          phase: CommitPhase.Mutation,
          effects: emptyEffects,
        },
        {
          type: 'COMMIT_START',
          id: 1,
          phase: CommitPhase.Layout,
          effects: layoutEffects,
        },
        {
          type: 'COMMIT_END',
          id: 1,
          phase: CommitPhase.Layout,
          effects: emptyEffects,
        },
        {
          type: 'COMMIT_START',
          id: 1,
          phase: CommitPhase.Passive,
          effects: passiveEffects,
        },
        {
          type: 'COMMIT_END',
          id: 1,
          phase: CommitPhase.Passive,
          effects: emptyEffects,
        },
        {
          type: 'UPDATE_SUCCESS',
          id: 1,
          lanes: Lane.UserBlockingLane,
        },
      ];

      for (const event of events) {
        profiler.onRuntimeEvent(event);
      }

      expect(reporter.reportProfile).toHaveBeenCalledOnce();
      expect(reporter.reportProfile).toHaveBeenCalledWith({
        id: 1,
        status: 'success',
        pendingPhaeses: 0,
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
      const mutationEffects = createEffectQueue([
        new MockEffect(),
        new MockEffect(),
      ]);
      const layoutEffects = createEffectQueue([new MockEffect()]);
      const passiveEffects = createEffectQueue([]);
      const error = new Error('fail');
      const events: RuntimeEvent[] = [
        {
          type: 'UPDATE_START',
          id: 1,
          lanes: Lane.UserBlockingLane,
        },
        {
          type: 'RENDER_START',
          id: 1,
          mutationEffects,
          layoutEffects,
          passiveEffects,
        },
        {
          type: 'COMPONENT_RENDER_START',
          id: 1,
          component,
          props: {},
          context: {} as RenderContext,
        },
        {
          type: 'COMPONENT_RENDER_END',
          id: 1,
          component,
          props: {},
          context: {} as RenderContext,
        },
        {
          type: 'RENDER_END',
          id: 1,
          mutationEffects,
          layoutEffects,
          passiveEffects,
        },
        {
          type: 'UPDATE_FAILURE',
          id: 1,
          lanes: Lane.UserBlockingLane,
          error,
        },
      ];

      for (const event of events) {
        profiler.onRuntimeEvent(event);
      }

      expect(reporter.reportProfile).toHaveBeenCalledOnce();
      expect(reporter.reportProfile).toHaveBeenCalledWith({
        id: 1,
        status: 'failure',
        pendingPhaeses: 2,
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
          type: 'UPDATE_START',
          id: 1,
          lanes: Lane.UserBlockingLane,
        },
        {
          type: 'RENDER_START',
          id: 1,
          mutationEffects,
          layoutEffects,
          passiveEffects,
        },
        {
          type: 'COMPONENT_RENDER_START',
          id: 1,
          component,
          props: {},
          context: {} as RenderContext,
        },
        {
          type: 'COMPONENT_RENDER_END',
          id: 1,
          component,
          props: {},
          context: {} as RenderContext,
        },
        {
          type: 'RENDER_END',
          id: 1,
          mutationEffects,
          layoutEffects,
          passiveEffects,
        },
        {
          type: 'COMMIT_START',
          id: 1,
          phase: CommitPhase.Mutation,
          effects: mutationEffects,
        },
        {
          type: 'COMMIT_END',
          id: 1,
          phase: CommitPhase.Mutation,
          effects: emptyEffects,
        },
        {
          type: 'UPDATE_SUCCESS',
          id: 1,
          lanes: Lane.UserBlockingLane,
        },
        {
          type: 'COMMIT_START',
          id: 1,
          phase: CommitPhase.Passive,
          effects: passiveEffects,
        },
        {
          type: 'COMMIT_END',
          id: 1,
          phase: CommitPhase.Passive,
          effects: emptyEffects,
        },
      ];

      for (const event of events) {
        profiler.onRuntimeEvent(event);
      }

      expect(reporter.reportProfile).toHaveBeenCalledOnce();
      expect(reporter.reportProfile).toHaveBeenCalledWith({
        id: 1,
        status: 'success',
        pendingPhaeses: 0,
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
  });
});

describe('ConsoleReporter', () => {
  describe('reportProfile()', () => {
    it.each([
      [
        {
          id: 1,
          status: 'pending',
          pendingPhaeses: 0,
          updateMeasurement: null,
          renderMeasurement: null,
          componentMeasurements: [],
          mutationMeasurement: null,
          layoutMeasurement: null,
          passiveMeasurement: null,
        },
        [],
      ],
      [
        {
          id: 1,
          status: 'success',
          pendingPhaeses: 0,
          updateMeasurement: {
            success: true,
            startTime: 0,
            duration: 10,
            lanes: Lane.ViewTransitionLane,
          },
          renderMeasurement: null,
          componentMeasurements: [],
          mutationMeasurement: null,
          layoutMeasurement: null,
          passiveMeasurement: null,
        },
        [
          [
            'groupCollapsed',
            'Transition #1 SUCCESS without priority in %c10ms',
          ],
          ['groupEnd'],
        ],
      ],
      [
        {
          id: 1,
          status: 'success',
          pendingPhaeses: 0,
          updateMeasurement: {
            success: true,
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
            'Update #1 SUCCESS with user-blocking priority in %c10ms',
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
          ['log', '%cMUTATION PHASE:%c 3 effect(s) committed in %c3ms'],
          ['log', '%cLAYOUT PHASE:%c 2 effect(s) committed in %c2ms'],
          ['log', '%cPASSIVE PHASE:%c 1 effect(s) committed in %c1ms'],
          ['groupEnd'],
        ],
      ],
      [
        {
          id: 1,
          status: 'failure',
          pendingPhaeses: 0,
          updateMeasurement: {
            success: false,
            error: new Error('fail'),
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
          mutationMeasurement: null,
          layoutMeasurement: null,
          passiveMeasurement: null,
        },
        [
          [
            'groupCollapsed',
            'Update #1 FAILURE with user-blocking priority in %c10ms',
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
    ] as [
      PerformanceProfile,
      [keyof ConsoleLogger, ...unknown[]][],
    ][])('prints the profile to the console', (profile, expectedLogs) => {
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
