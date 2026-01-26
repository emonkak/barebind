import { describe, expect, it, vi } from 'vitest';

import {
  type ConsoleLogger,
  ConsoleReporter,
  type PerformanceProfile,
  PerformanceProfiler,
} from '@/addons/profiler.js';
import { createComponent } from '@/component.js';
import { CommitPhase, Lanes, type RenderContext } from '@/internal.js';
import type { RuntimeEvent } from '@/runtime.js';
import { createEffectQueue, MockEffect } from '../../mocks.js';

describe('PerformanceProfiler', () => {
  describe('onRuntimeEvent()', () => {
    it('collects profiles from session events', () => {
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
      const events: RuntimeEvent[] = [
        {
          type: 'UPDATE_START',
          id: 1,
          lanes: Lanes.UserBlockingLane,
        },
        {
          type: 'RENDER_START',
          id: 1,
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
          effects: mutationEffects,
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
          effects: layoutEffects,
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
          effects: passiveEffects,
        },
        {
          type: 'UPDATE_END',
          id: 1,
          lanes: Lanes.UserBlockingLane,
        },
      ];

      for (const event of events) {
        profiler.onRuntimeEvent(event);
      }

      expect(reporter.reportProfile).toHaveBeenCalledOnce();
      expect(reporter.reportProfile).toHaveBeenCalledWith({
        id: 1,
        updateMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
          lanes: Lanes.UserBlockingLane,
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
          totalEffects: 2,
        },
        layoutMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
          totalEffects: 1,
        },
        passiveMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
          totalEffects: 0,
        },
      });
    });
  });
});

describe('ConsoleReporter', () => {
  describe('reportProfile()', () => {
    it.each([
      [
        {
          id: 1,
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
          updateMeasurement: {
            startTime: 0,
            duration: 10,
            lanes: Lanes.ViewTransitionLane,
          },
          renderMeasurement: null,
          componentMeasurements: [],
          mutationMeasurement: null,
          layoutMeasurement: null,
          passiveMeasurement: null,
        },
        [
          ['groupCollapsed', 'Transition #1 without priority in %c10ms'],
          ['groupEnd'],
        ],
      ],
      [
        {
          id: 1,
          updateMeasurement: {
            startTime: 0,
            duration: 10,
            lanes: Lanes.UserBlockingLane,
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
            totalEffects: 3,
          },
          layoutMeasurement: {
            startTime: 7,
            duration: 2,
            totalEffects: 2,
          },
          passiveMeasurement: {
            startTime: 9,
            duration: 1,
            totalEffects: 1,
          },
        },
        [
          ['groupCollapsed', 'Update #1 with user-blocking priority in %c10ms'],
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
    ] as [
      PerformanceProfile,
      [keyof ConsoleLogger, ...unknown[]][],
    ][])('logs the profile', (profile, expectedLogs) => {
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
