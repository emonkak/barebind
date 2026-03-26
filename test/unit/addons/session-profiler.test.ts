import { describe, expect, it, vi } from 'vitest';

import {
  type ConsoleLogger,
  ConsoleReporter,
  type SessionProfile,
  SessionProfiler,
} from '@/addons/session-profiler.js';
import type { Lanes, SessionEvent } from '@/core.js';
import { InterruptError } from '@/error.js';
import {
  BackgroundLane,
  ConcurrentLane,
  NoLanes,
  SyncLane,
  TransitionLane1,
  UserBlockingLane,
  UserVisibleLane,
  ViewTransitionLane,
} from '@/lane.js';
import { createEffect, createEffectQueue, MockCoroutine } from '../../mocks.js';

describe('SessionProfiler', () => {
  const coroutine = new MockCoroutine('Foo');

  describe('onSessionEvent()', () => {
    it('reports profiles with completed status when update succeeds', () => {
      const reporter = {
        reportProfile: vi.fn(),
      };
      const profiler = new SessionProfiler(reporter);

      const mutationEffects = createEffectQueue(createEffect(), createEffect());
      const layoutEffects = createEffectQueue(createEffect());
      const passiveEffects = createEffectQueue(createEffect());
      const events: SessionEvent[] = [
        {
          type: 'render-start',
          id: 0,
          lanes: ConcurrentLane,
        },
        {
          type: 'coroutine-start',
          id: 0,
          coroutine,
        },
        {
          type: 'coroutine-end',
          id: 0,
          coroutine,
        },
        {
          type: 'render-end',
          id: 0,
          lanes: ConcurrentLane,
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
        status: 'completed',
        phase: 'postcommit',
        renderMeasurement: {
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          lanes: ConcurrentLane,
        },
        commitMeasurement: {
          startTime: expect.any(Number),
          endTime: expect.any(Number),
        },
        errorRecords: [],
        coroutineRecords: [
          {
            name: 'Foo',
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

    it('reports profiles with completed status when transition fails', () => {
      const reporter = {
        reportProfile: vi.fn(),
      };
      const profiler = new SessionProfiler(reporter);

      const error = new InterruptError(new MockCoroutine());
      const events: SessionEvent[] = [
        {
          type: 'render-start',
          id: 0,
          lanes: ConcurrentLane,
        },
        {
          type: 'render-end',
          id: 0,
          lanes: ConcurrentLane,
        },
        {
          type: 'commit-cancel',
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
          lanes: ConcurrentLane,
        },
        commitMeasurement: null,
        errorRecords: [],
        coroutineRecords: [],
        effectRecords: [],
      } satisfies SessionProfile);
    });

    it('reports profiles with failed status when update fails', () => {
      const reporter = {
        reportProfile: vi.fn(),
      };
      const profiler = new SessionProfiler(reporter);

      const error = new Error('fail');
      const events: SessionEvent[] = [
        {
          type: 'render-start',
          id: 0,
          lanes: UserBlockingLane,
        },
        {
          type: 'coroutine-start',
          id: 0,
          coroutine,
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
          lanes: UserBlockingLane,
        },
        {
          type: 'commit-cancel',
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
          lanes: UserBlockingLane,
        },
        commitMeasurement: null,
        errorRecords: [
          {
            error,
            captured: false,
          },
        ],
        coroutineRecords: [
          {
            name: 'Foo',
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

      const error = new InterruptError(new MockCoroutine());
      const events: SessionEvent[] = [
        {
          type: 'render-start',
          id: 0,
          lanes: ConcurrentLane,
        },
        {
          type: 'coroutine-start',
          id: 0,
          coroutine,
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
          lanes: ConcurrentLane,
        },
        {
          type: 'commit-cancel',
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
          lanes: ConcurrentLane,
        },
        commitMeasurement: null,
        errorRecords: [
          {
            error,
            captured: false,
          },
        ],
        coroutineRecords: [
          {
            name: 'Foo',
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

      const mutationEffects = createEffectQueue(createEffect(), createEffect());
      const passiveEffects = createEffectQueue(createEffect());
      const events: SessionEvent[] = [
        {
          type: 'render-start',
          id: 0,
          lanes: ConcurrentLane,
        },
        {
          type: 'coroutine-start',
          id: 0,
          coroutine,
        },
        {
          type: 'coroutine-end',
          id: 0,
          coroutine,
        },
        {
          type: 'render-end',
          id: 0,
          lanes: UserBlockingLane,
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
        status: 'completed',
        phase: 'postcommit',
        renderMeasurement: {
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          lanes: ConcurrentLane,
        },
        commitMeasurement: {
          startTime: expect.any(Number),
          endTime: expect.any(Number),
        },
        errorRecords: [],
        coroutineRecords: [
          {
            name: 'Foo',
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

      const mutationEffects = createEffectQueue(createEffect(), createEffect());
      const passiveEffects = createEffectQueue(createEffect());
      const events: SessionEvent[] = [
        {
          type: 'render-start',
          id: 0,
          lanes: ConcurrentLane,
        },
        {
          type: 'coroutine-start',
          id: 0,
          coroutine,
        },
        {
          type: 'coroutine-end',
          id: 0,
          coroutine,
        },
        {
          type: 'render-end',
          id: 0,
          lanes: ConcurrentLane,
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
        status: 'completed',
        phase: 'postcommit',
        renderMeasurement: {
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          lanes: ConcurrentLane,
        },
        commitMeasurement: {
          startTime: expect.any(Number),
          endTime: expect.any(Number),
        },
        errorRecords: [],
        coroutineRecords: [
          {
            name: 'Foo',
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
          lanes: ConcurrentLane,
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
        coroutineRecords: [],
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
        status: 'completed',
        renderMeasurement: {
          startTime: 0,
          endTime: 10,
          lanes: ConcurrentLane | TransitionLane1 | ViewTransitionLane,
        },
        commitMeasurement: null,
        errorRecords: [],
        coroutineRecords: [],
        effectRecords: [],
      });

      expect(logger.flush()).toStrictEqual([
        [
          'groupCollapsed',
          '#0 Transition1/ViewTransition COMPLETED without priority in concurrent mode after %c10ms',
        ],
        ['group', '%cRENDER PHASE:%c 0 coroutine(s) resumed after %c10ms'],
        ['groupEnd'],
        ['groupEnd'],
      ]);
    });

    it.each<[Lanes, TaskPriority]>([
      [ConcurrentLane | UserBlockingLane, 'user-blocking'],
      [ConcurrentLane | UserVisibleLane, 'user-visible'],
      [ConcurrentLane | BackgroundLane, 'background'],
    ])('reports the priority when lanes contains a priority lane', (lanes, expectedPriority) => {
      reporter.reportProfile({
        id: 0,
        phase: 'prerender',
        status: 'completed',
        renderMeasurement: {
          startTime: 0,
          endTime: 10,
          lanes,
        },
        commitMeasurement: null,
        errorRecords: [],
        coroutineRecords: [],
        effectRecords: [],
      });

      expect(logger.flush()).toStrictEqual([
        [
          'groupCollapsed',
          `#0 Update COMPLETED with ${expectedPriority} priority in concurrent mode after %c10ms`,
        ],
        ['group', '%cRENDER PHASE:%c 0 coroutine(s) resumed after %c10ms'],
        ['groupEnd'],
        ['groupEnd'],
      ]);
    });

    it.each<[Lanes, string]>([
      [ConcurrentLane, 'concurrent'],
      [SyncLane, 'sync'],
      [NoLanes, 'no'],
    ])('reports the mode when lanes contains a mode lane', (lanes, expectedMode) => {
      reporter.reportProfile({
        id: 0,
        phase: 'prerender',
        status: 'completed',
        renderMeasurement: {
          startTime: 0,
          endTime: 10,
          lanes,
        },
        commitMeasurement: null,
        errorRecords: [],
        coroutineRecords: [],
        effectRecords: [],
      });

      expect(logger.flush()).toStrictEqual([
        [
          'groupCollapsed',
          `#0 Update COMPLETED without priority in ${expectedMode} mode after %c10ms`,
        ],
        ['group', '%cRENDER PHASE:%c 0 coroutine(s) resumed after %c10ms'],
        ['groupEnd'],
        ['groupEnd'],
      ]);
    });

    it('reports coroutine records when render is measured', () => {
      const profile: SessionProfile = {
        id: 0,
        phase: 'prerender',
        status: 'completed',
        renderMeasurement: {
          startTime: 0,
          endTime: 10,
          lanes: ConcurrentLane,
        },
        commitMeasurement: null,
        errorRecords: [],
        coroutineRecords: [
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
          `#0 Update COMPLETED without priority in concurrent mode after %c10ms`,
        ],
        ['group', '%cRENDER PHASE:%c 2 coroutine(s) resumed after %c10ms'],
        [
          'table',
          profile.coroutineRecords.map(({ name, startTime, endTime }) => ({
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
        status: 'interrupted',
        renderMeasurement: {
          startTime: 0,
          endTime: 10,
          lanes: ConcurrentLane,
        },
        commitMeasurement: null,
        errorRecords: [
          {
            error,
            captured: true,
          },
        ],
        coroutineRecords: [],
        effectRecords: [],
      };

      reporter.reportProfile(profile);

      expect(logger.flush()).toStrictEqual([
        [
          'groupCollapsed',
          `#0 Update INTERRUPTED without priority in concurrent mode after %c10ms`,
        ],
        ['group', '%cRENDER PHASE:%c 0 coroutine(s) resumed after %c10ms'],
        ['table', profile.errorRecords],
        ['groupEnd'],
        ['groupEnd'],
      ]);
    });

    it('reports effect records when commit is measured', () => {
      const profile: SessionProfile = {
        id: 0,
        phase: 'prerender',
        status: 'completed',
        renderMeasurement: null,
        commitMeasurement: {
          startTime: 0,
          endTime: 3,
        },
        errorRecords: [],
        coroutineRecords: [],
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
          `#0 Update COMPLETED without priority in no mode after %c3ms`,
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
