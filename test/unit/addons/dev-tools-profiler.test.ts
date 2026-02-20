import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { DevToolsProfiler } from '@/addons/dev-tools-profiler.js';
import { createComponent } from '@/component.js';
import { CommitPhase, EffectQueue } from '@/internal.js';

const Foo = createComponent(function Foo() {});

const Bar = createComponent(function Bar() {});

interface MockPerformance {
  mark: Mock<typeof performance.mark>;
  measure: Mock<typeof performance.measure>;
}

describe('DevToolsProfiler', () => {
  let performance: MockPerformance;
  let profiler: DevToolsProfiler;

  beforeEach(() => {
    performance = createMockPerformance();
    profiler = new DevToolsProfiler(performance);
  });

  describe('update-start / update-success', () => {
    it('records an end mark and a measure', () => {
      profiler.onRuntimeEvent({ type: 'update-start', id: 0, lanes: 0 });
      profiler.onRuntimeEvent({ type: 'update-success', id: 0, lanes: 0 });

      expect(marksOf(performance)).toStrictEqual([
        'barebind:update-start:0',
        'barebind:update-end:0',
      ]);
      expect(measuresOf(performance)).toStrictEqual([
        {
          name: 'Barebind - Update success #0',
          start: 'barebind:update-start:0',
          end: 'barebind:update-end:0',
        },
      ]);
    });
  });

  describe('update-start / update-failure', () => {
    it('records an end mark and a failure measure', () => {
      profiler.onRuntimeEvent({ type: 'update-start', id: 0, lanes: 0 });
      profiler.onRuntimeEvent({
        type: 'update-failure',
        id: 0,
        lanes: 0,
        error: new Error('oops'),
      });

      expect(marksOf(performance)).toStrictEqual([
        'barebind:update-start:0',
        'barebind:update-end:0',
      ]);
      expect(measuresOf(performance)).toStrictEqual([
        {
          name: 'Barebind - Update failure #0',
          start: 'barebind:update-start:0',
          end: 'barebind:update-end:0',
        },
      ]);
    });
  });

  describe('render-phase-start / render-phase-end', () => {
    it('records marks and a measure', () => {
      profiler.onRuntimeEvent({ type: 'render-phase-start', id: 0 });
      profiler.onRuntimeEvent({ type: 'render-phase-end', id: 0 });

      expect(marksOf(performance)).toStrictEqual([
        'barebind:render-phase-start:0',
        'barebind:render-phase-end:0',
      ]);
      expect(measuresOf(performance)).toStrictEqual([
        {
          name: 'Barebind - Render phase #0',
          start: 'barebind:render-phase-start:0',
          end: 'barebind:render-phase-end:0',
        },
      ]);
    });
  });

  describe('component-render-start / component-render-end', () => {
    it('records marks and a measure for a single component', () => {
      profiler.onRuntimeEvent({ type: 'update-start', id: 0, lanes: 0 });
      profiler.onRuntimeEvent({
        type: 'component-render-start',
        id: 0,
        component: Foo,
        props: {},
        context: null as any,
      });
      profiler.onRuntimeEvent({
        type: 'component-render-end',
        id: 0,
        component: Foo,
        props: {},
        context: null as any,
      });

      expect(marksOf(performance)).toStrictEqual([
        'barebind:update-start:0',
        `barebind:component-render-start:0:${Foo.name}:0`,
        `barebind:component-render-end:0:${Foo.name}:0`,
      ]);
      expect(measuresOf(performance)).toStrictEqual([
        {
          name: `Barebind - Render ${Foo.name} #0`,
          start: `barebind:component-render-start:0:${Foo.name}:0`,
          end: `barebind:component-render-end:0:${Foo.name}:0`,
        },
      ]);
    });

    it('disambiguates multiple renders of the same component', () => {
      profiler.onRuntimeEvent({ type: 'update-start', id: 0, lanes: 0 });

      for (let i = 0; i < 3; i++) {
        profiler.onRuntimeEvent({
          type: 'component-render-start',
          id: 0,
          component: Foo,
          props: {},
          context: null as any,
        });
        profiler.onRuntimeEvent({
          type: 'component-render-end',
          id: 0,
          component: Foo,
          props: {},
          context: null as any,
        });
      }

      expect(marksOf(performance)).toStrictEqual([
        `barebind:update-start:0`,
        `barebind:component-render-start:0:${Foo.name}:0`,
        `barebind:component-render-end:0:${Foo.name}:0`,
        `barebind:component-render-start:0:${Foo.name}:1`,
        `barebind:component-render-end:0:${Foo.name}:1`,
        `barebind:component-render-start:0:${Foo.name}:2`,
        `barebind:component-render-end:0:${Foo.name}:2`,
      ]);
      expect(measuresOf(performance)).toStrictEqual([
        {
          name: `Barebind - Render ${Foo.name} #0`,
          start: `barebind:component-render-start:0:${Foo.name}:0`,
          end: `barebind:component-render-end:0:${Foo.name}:0`,
        },
        {
          name: `Barebind - Render ${Foo.name} #0`,
          start: `barebind:component-render-start:0:${Foo.name}:1`,
          end: `barebind:component-render-end:0:${Foo.name}:1`,
        },
        {
          name: `Barebind - Render ${Foo.name} #0`,
          start: `barebind:component-render-start:0:${Foo.name}:2`,
          end: `barebind:component-render-end:0:${Foo.name}:2`,
        },
      ]);
    });

    it('disambiguates different components within the same update', () => {
      profiler.onRuntimeEvent({ type: 'update-start', id: 0, lanes: 0 });
      profiler.onRuntimeEvent({
        type: 'component-render-start',
        id: 0,
        component: Foo,
        props: {},
        context: null as any,
      });
      profiler.onRuntimeEvent({
        type: 'component-render-end',
        id: 0,
        component: Foo,
        props: {},
        context: null as any,
      });
      profiler.onRuntimeEvent({
        type: 'component-render-start',
        id: 0,
        component: Bar,
        props: {},
        context: null as any,
      });
      profiler.onRuntimeEvent({
        type: 'component-render-end',
        id: 0,
        component: Bar,
        props: {},
        context: null as any,
      });

      expect(measuresOf(performance)).toStrictEqual([
        {
          name: `Barebind - Render ${Foo.name} #0`,
          start: `barebind:component-render-start:0:${Foo.name}:0`,
          end: `barebind:component-render-end:0:${Foo.name}:0`,
        },
        {
          name: `Barebind - Render ${Bar.name} #0`,
          start: `barebind:component-render-start:0:${Bar.name}:1`,
          end: `barebind:component-render-end:0:${Bar.name}:1`,
        },
      ]);
    });

    it('resets component index on each update-start', () => {
      for (const id of [0, 1]) {
        profiler.onRuntimeEvent({ type: 'update-start', id, lanes: 0 });
        profiler.onRuntimeEvent({
          type: 'component-render-start',
          id,
          component: Foo,
          props: {},
          context: null as any,
        });
        profiler.onRuntimeEvent({
          type: 'component-render-end',
          id,
          component: Foo,
          props: {},
          context: null as any,
        });
      }

      expect(measuresOf(performance)).toStrictEqual([
        {
          name: `Barebind - Render ${Foo.name} #0`,
          start: `barebind:component-render-start:0:${Foo.name}:0`,
          end: `barebind:component-render-end:0:${Foo.name}:0`,
        },
        {
          name: `Barebind - Render ${Foo.name} #1`,
          start: `barebind:component-render-start:1:${Foo.name}:0`,
          end: `barebind:component-render-end:1:${Foo.name}:0`,
        },
      ]);
    });
  });

  describe('commit-phase-start / commit-phase-end', () => {
    it('records marks and a measure', () => {
      profiler.onRuntimeEvent({
        type: 'commit-phase-start',
        id: 0,
        mutationEffects: new EffectQueue(),
        layoutEffects: new EffectQueue(),
        passiveEffects: new EffectQueue(),
      });
      profiler.onRuntimeEvent({
        type: 'commit-phase-end',
        id: 0,
        mutationEffects: new EffectQueue(),
        layoutEffects: new EffectQueue(),
        passiveEffects: new EffectQueue(),
      });

      expect(marksOf(performance)).toStrictEqual([
        'barebind:commit-phase-start:0',
        'barebind:commit-phase-end:0',
      ]);
      expect(measuresOf(performance)).toStrictEqual([
        {
          name: 'Barebind - Commit phase #0',
          start: 'barebind:commit-phase-start:0',
          end: 'barebind:commit-phase-end:0',
        },
      ]);
    });
  });

  describe('effect-commit-start / effect-commit-end', () => {
    it.each([
      [CommitPhase.Mutation, 'mutation'],
      [CommitPhase.Layout, 'layout'],
      [CommitPhase.Passive, 'passive'],
    ] as const)('records marks and a measure for %s phase', (phase, name) => {
      profiler.onRuntimeEvent({
        type: 'effect-commit-start',
        id: 0,
        effects: new EffectQueue(),
        phase,
      });
      profiler.onRuntimeEvent({
        type: 'effect-commit-end',
        id: 0,
        effects: new EffectQueue(),
        phase,
      });

      expect(marksOf(performance)).toStrictEqual([
        `barebind:effect-commit-start:${name}:0`,
        `barebind:effect-commit-end:${name}:0`,
      ]);
      expect(measuresOf(performance)).toStrictEqual([
        {
          name: `Barebind - Commit ${name} effects #0`,
          start: `barebind:effect-commit-start:${name}:0`,
          end: `barebind:effect-commit-end:${name}:0`,
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
        profiler.onRuntimeEvent({ type: 'update-success', id: 99, lanes: 0 });
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
