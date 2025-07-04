import { describe, expect, it, vi } from 'vitest';
import type { Effect } from '@/directive.js';
import {
  type Logger,
  LogReporter,
  type Profile,
  Profiler,
} from '@/extensions/profiler.js';
import { CommitPhase } from '@/renderHost.js';
import type { RuntimeEvent } from '@/runtime.js';
import { MockComponent, MockEffect } from '../../mocks.js';

describe('Profiler', () => {
  describe('onRuntimeEvent()', () => {
    it('collects profiles from runtime events', () => {
      const reporter = {
        reportProfile: vi.fn(),
      };
      const profiler = new Profiler(reporter);

      const component = new MockComponent();
      const mutationEffects = [new MockEffect(), new MockEffect()];
      const layoutEffects = [new MockEffect()];
      const passiveEffects: Effect[] = [];
      const events: RuntimeEvent[] = [
        {
          type: 'UPDATE_START',
          id: 0,
          priority: 'user-blocking',
          transition: false,
        },
        {
          type: 'RENDER_START',
          id: 0,
        },
        {
          type: 'COMPONENT_RENDER_START',
          id: 0,
          component,
          props: {},
        },
        {
          type: 'TEMPLATE_CREATE_START',
          id: 0,
          strings: ['<div>', '</div>'],
          binds: [],
          mode: 'html',
        },
        {
          type: 'TEMPLATE_CREATE_END',
          id: 0,
          strings: ['<div>', '</div>'],
          binds: [],
          mode: 'html',
        },
        {
          type: 'COMPONENT_RENDER_END',
          id: 0,
          component,
          props: {},
        },
        {
          type: 'RENDER_END',
          id: 0,
        },
        {
          type: 'COMMIT_START',
          id: 0,
          phase: CommitPhase.Mutation,
          effects: mutationEffects,
        },
        {
          type: 'COMMIT_END',
          id: 0,
          phase: CommitPhase.Mutation,
          effects: mutationEffects,
        },
        {
          type: 'COMMIT_START',
          id: 0,
          phase: CommitPhase.Layout,
          effects: layoutEffects,
        },
        {
          type: 'COMMIT_END',
          id: 0,
          phase: CommitPhase.Layout,
          effects: layoutEffects,
        },
        {
          type: 'COMMIT_START',
          id: 0,
          phase: CommitPhase.Passive,
          effects: passiveEffects,
        },
        {
          type: 'COMMIT_END',
          id: 0,
          phase: CommitPhase.Passive,
          effects: passiveEffects,
        },
        {
          type: 'UPDATE_END',
          id: 0,
          priority: 'user-blocking',
          transition: false,
        },
      ];

      for (const event of events) {
        profiler.onRuntimeEvent(event);
      }

      expect(reporter.reportProfile).toHaveBeenCalledOnce();
      expect(reporter.reportProfile).toHaveBeenCalledWith({
        id: 0,
        updateMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
          priority: 'user-blocking',
          transition: false,
        },
        renderMeasurement: {
          startTime: expect.any(Number),
          duration: expect.any(Number),
        },
        componentMeasurements: [
          {
            name: 'MockComponent',
            startTime: expect.any(Number),
            duration: expect.any(Number),
          },
        ],
        templateMeasurements: [
          {
            content: '<div>{}</div>',
            mode: 'html',
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

describe('LogReporter', () => {
  describe('reportProfile()', () => {
    it.each([
      [
        {
          id: 0,
          updateMeasurement: null,
          renderMeasurement: null,
          componentMeasurements: [],
          templateMeasurements: [],
          mutationMeasurement: null,
          layoutMeasurement: null,
          passiveMeasurement: null,
        },
        [],
      ],

      [
        {
          id: 0,
          updateMeasurement: {
            startTime: 0,
            duration: 10,
            priority: null,
            transition: true,
          },
          renderMeasurement: null,
          componentMeasurements: [],
          templateMeasurements: [],
          mutationMeasurement: null,
          layoutMeasurement: null,
          passiveMeasurement: null,
        },
        [['group', 'Transition #0 without priority in %c10ms'], ['groupEnd']],
      ],
      [
        {
          id: 0,
          updateMeasurement: {
            startTime: 0,
            duration: 10,
            priority: 'user-blocking',
            transition: false,
          },
          renderMeasurement: {
            startTime: 0,
            duration: 4,
          },
          componentMeasurements: [
            {
              name: 'MockComponent',
              startTime: 0,
              duration: 4,
            },
          ],
          templateMeasurements: [
            {
              content: '<div>{}</div>',
              mode: 'html',
              startTime: 0,
              duration: 1,
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
          ['group', 'Update #0 with user-blocking priority in %c10ms'],
          ['group', '%cRENDER PHASE:%c 1 component(s) rendered in %c4ms'],
          [
            'table',
            [
              {
                name: 'MockComponent',
                startTime: 0,
                duration: 4,
              },
            ],
          ],
          [
            'table',
            [
              {
                content: '<div>{}</div>',
                mode: 'html',
                startTime: 0,
                duration: 1,
              },
            ],
          ],
          ['groupEnd'],
          ['log', '%cMUTATION PHASE:%c 3 effect(s) committed in %c3ms'],
          ['log', '%cLAYOUT PHASE:%c 2 effect(s) committed in %c2ms'],
          ['log', '%cPASSIVE PHASE:%c 1 effect(s) committed in %c1ms'],
          ['groupEnd'],
        ],
      ],
    ] as [Profile, [keyof Logger, ...unknown[]][]][])(
      'logs the profile',
      (profile, expectedLogs) => {
        const logger = new MockLogger();
        const reporter = new LogReporter(logger);

        reporter.reportProfile(profile);

        expect(logger.flush()).toStrictEqual(expectedLogs);
      },
    );
  });
});

type Log = [keyof Logger, ...unknown[]];

class MockLogger implements Logger {
  private _logs: Log[] = [];

  flush(): Log[] {
    const logs = this._logs;
    this._logs = [];
    return logs;
  }

  group(...args: unknown[]): void {
    this._logs.push(['group', args[0]]);
  }

  groupEnd(): void {
    this._logs.push(['groupEnd']);
  }

  log(...args: unknown[]): void {
    this._logs.push(['log', args[0]]);
  }

  table(...args: unknown[]): void {
    this._logs.push(['table', args[0]]);
  }
}
