import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { DevToolsProfiler } from '@/addons/dev-tools-profiler.js';
import { type CommitPhase, EffectQueue } from '@/core.js';
import { MockCoroutine } from '../../mocks.js';

interface MockPerformance {
  mark: Mock<typeof performance.mark>;
  measure: Mock<typeof performance.measure>;
}

describe('DevToolsProfiler', () => {
  const Foo = new MockCoroutine('Foo');
  const Bar = new MockCoroutine('Bar');

  let performance: MockPerformance;
  let profiler: DevToolsProfiler;

  beforeEach(() => {
    performance = createMockPerformance();
    profiler = new DevToolsProfiler(performance);
  });

  describe('render-start / render-end', () => {
    it('records marks and a measure', () => {
      profiler.onSessionEvent({ type: 'render-start', id: 0, lanes: 0 });
      profiler.onSessionEvent({ type: 'render-end', id: 0, lanes: 0 });

      expect(marksOf(performance)).toStrictEqual([
        'barebind:render-start:0',
        'barebind:render-end:0',
      ]);
      expect(measuresOf(performance)).toStrictEqual([
        {
          name: 'Barebind - Render phase #0',
          start: 'barebind:render-start:0',
          end: 'barebind:render-end:0',
        },
      ]);
    });
  });

  describe('coroutine-start / coroutine-end', () => {
    it('records marks and a measure for a single component', () => {
      profiler.onSessionEvent({ type: 'render-start', id: 0, lanes: 0 });
      profiler.onSessionEvent({
        type: 'coroutine-start',
        id: 0,
        coroutine: Foo,
      });
      profiler.onSessionEvent({
        type: 'coroutine-end',
        id: 0,
        coroutine: Foo,
      });

      expect(marksOf(performance)).toStrictEqual([
        'barebind:render-start:0',
        `barebind:coroutine-start:0:Foo:0`,
        `barebind:coroutine-end:0:Foo:0`,
      ]);
      expect(measuresOf(performance)).toStrictEqual([
        {
          name: `Barebind - Render Foo #0`,
          start: `barebind:coroutine-start:0:Foo:0`,
          end: `barebind:coroutine-end:0:Foo:0`,
        },
      ]);
    });

    it('disambiguates multiple renders of the same component', () => {
      profiler.onSessionEvent({ type: 'render-start', id: 0, lanes: 0 });

      for (let i = 0; i < 3; i++) {
        profiler.onSessionEvent({
          type: 'coroutine-start',
          id: 0,
          coroutine: Foo,
        });
        profiler.onSessionEvent({
          type: 'coroutine-end',
          id: 0,
          coroutine: Foo,
        });
      }

      expect(marksOf(performance)).toStrictEqual([
        `barebind:render-start:0`,
        `barebind:coroutine-start:0:Foo:0`,
        `barebind:coroutine-end:0:Foo:0`,
        `barebind:coroutine-start:0:Foo:1`,
        `barebind:coroutine-end:0:Foo:1`,
        `barebind:coroutine-start:0:Foo:2`,
        `barebind:coroutine-end:0:Foo:2`,
      ]);
      expect(measuresOf(performance)).toStrictEqual([
        {
          name: `Barebind - Render Foo #0`,
          start: `barebind:coroutine-start:0:Foo:0`,
          end: `barebind:coroutine-end:0:Foo:0`,
        },
        {
          name: `Barebind - Render Foo #0`,
          start: `barebind:coroutine-start:0:Foo:1`,
          end: `barebind:coroutine-end:0:Foo:1`,
        },
        {
          name: `Barebind - Render Foo #0`,
          start: `barebind:coroutine-start:0:Foo:2`,
          end: `barebind:coroutine-end:0:Foo:2`,
        },
      ]);
    });

    it('disambiguates different components within the same update', () => {
      profiler.onSessionEvent({ type: 'render-start', id: 0, lanes: 0 });
      profiler.onSessionEvent({
        type: 'coroutine-start',
        id: 0,
        coroutine: Foo,
      });
      profiler.onSessionEvent({
        type: 'coroutine-end',
        id: 0,
        coroutine: Foo,
      });
      profiler.onSessionEvent({
        type: 'coroutine-start',
        id: 0,
        coroutine: Bar,
      });
      profiler.onSessionEvent({
        type: 'coroutine-end',
        id: 0,
        coroutine: Bar,
      });

      expect(measuresOf(performance)).toStrictEqual([
        {
          name: `Barebind - Render Foo #0`,
          start: `barebind:coroutine-start:0:Foo:0`,
          end: `barebind:coroutine-end:0:Foo:0`,
        },
        {
          name: `Barebind - Render Bar #0`,
          start: `barebind:coroutine-start:0:Bar:1`,
          end: `barebind:coroutine-end:0:Bar:1`,
        },
      ]);
    });

    it('resets component index on each update-start', () => {
      for (const id of [0, 1]) {
        profiler.onSessionEvent({ type: 'render-start', id, lanes: 0 });
        profiler.onSessionEvent({
          type: 'coroutine-start',
          id,
          coroutine: Foo,
        });
        profiler.onSessionEvent({
          type: 'coroutine-end',
          id,
          coroutine: Foo,
        });
      }

      expect(measuresOf(performance)).toStrictEqual([
        {
          name: `Barebind - Render Foo #0`,
          start: `barebind:coroutine-start:0:Foo:0`,
          end: `barebind:coroutine-end:0:Foo:0`,
        },
        {
          name: `Barebind - Render Foo #1`,
          start: `barebind:coroutine-start:1:Foo:0`,
          end: `barebind:coroutine-end:1:Foo:0`,
        },
      ]);
    });
  });

  describe('commit-start / commit-end', () => {
    it('records marks and a measure', () => {
      profiler.onSessionEvent({
        type: 'commit-start',
        id: 0,
      });
      profiler.onSessionEvent({
        type: 'commit-end',
        id: 0,
      });

      expect(marksOf(performance)).toStrictEqual([
        'barebind:commit-start:0',
        'barebind:commit-end:0',
      ]);
      expect(measuresOf(performance)).toStrictEqual([
        {
          name: 'Barebind - Commit phase #0',
          start: 'barebind:commit-start:0',
          end: 'barebind:commit-end:0',
        },
      ]);
    });
  });

  describe('effect-commit-start / effect-commit-end', () => {
    it.for<CommitPhase>([
      'mutation',
      'layout',
      'passive',
    ])('records marks and a measure for %s phase', (phase) => {
      profiler.onSessionEvent({
        type: 'effect-commit-start',
        id: 0,
        effects: new EffectQueue(),
        phase,
      });
      profiler.onSessionEvent({
        type: 'effect-commit-end',
        id: 0,
        effects: new EffectQueue(),
        phase,
      });

      expect(marksOf(performance)).toStrictEqual([
        `barebind:effect-commit-start:${phase}:0`,
        `barebind:effect-commit-end:${phase}:0`,
      ]);
      expect(measuresOf(performance)).toStrictEqual([
        {
          name: `Barebind - Commit ${phase} effects #0`,
          start: `barebind:effect-commit-start:${phase}:0`,
          end: `barebind:effect-commit-end:${phase}:0`,
        },
      ]);
    });
  });

  describe('measure error handling', () => {
    it('silently ignores measure errors when startMark is missing', () => {
      performance.measure.mockImplementation(() => {
        throw new DOMException('Mark not found', 'SyntaxError');
      });

      expect(() => {
        profiler.onSessionEvent({
          type: 'render-end',
          id: 99,
          lanes: 0,
        });
      }).not.toThrow();
    });
  });
});

function createMockPerformance(): MockPerformance {
  return {
    mark: vi.fn(),
    measure: vi.fn(),
  };
}

function marksOf(performance: MockPerformance): string[] {
  return performance.mark.mock.calls.map(([name]) => name);
}

function measuresOf(performance: MockPerformance): {
  name: string;
  start: string;
  end: string;
}[] {
  return performance.measure.mock.calls.map(([name, start, end]) => ({
    name,
    start: start as string,
    end: end as string,
  }));
}
