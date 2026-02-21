import { describe, expect, it, vi } from 'vitest';

import { shallowEqual } from '@/compare.js';
import {
  $hook,
  CommitPhase,
  DETACHED_SCOPE,
  EffectQueue,
  Lane,
  type RefObject,
  type RenderContext,
  type UpdateHandle,
} from '@/internal.js';
import { RenderSession } from '@/render-session.js';
import { MockTemplate } from '../mocks.js';
import { waitForMicrotasks, waitForTimeout } from '../test-helpers.js';
import { TestRenderer } from '../test-renderer.js';

describe('RenderSession', () => {
  describe('catchError()', () => {
    it('adds an error handler', () => {
      const handler = vi.fn();
      const error = {};
      const renderer = new TestRenderer((_props, session) => {
        session.catchError(handler);

        session.catchError((error, handleError) => {
          handleError(error);
        });

        throw error;
      });

      SESSION: {
        renderer.render({});

        expect(handler).toHaveBeenCalledOnce();
        expect(handler).toHaveBeenCalledWith(error, expect.any(Function));
      }
    });

    it('throws an error when trying to add an error handler outside of rendering', () => {
      const renderer = new TestRenderer((_props, session) => session);

      expect(() => {
        const session = renderer.render({});
        session.catchError(() => {});
      }).toThrow(TypeError);
    });
  });

  describe('getSessionContext()', () => {
    it('returns the runtime as a SessionContext', () => {
      const renderer = new TestRenderer((_props, session) => {
        return session.getSessionContext();
      });

      SESSION: {
        const session = renderer.render({});

        expect(session).toBe(renderer.runtime);
      }
    });
  });

  describe('getSharedContext()', () => {
    it('returns the shared context corresponding to the key', () => {
      const renderer = new TestRenderer((_props, session) => {
        session.setSharedContext('foo', 123);

        return session.getSharedContext('foo');
      });

      SESSION: {
        const value = renderer.render({});

        expect(value).toBe(123);
      }
    });

    it('returns undefined if the shared context is not definied', () => {
      const renderer = new TestRenderer((_props, session) => {
        return session.getSharedContext('foo');
      });

      SESSION: {
        const value = renderer.render({});

        expect(value).toBe(undefined);
      }
    });

    it('always returns undefined when trying to get a shared context outside of rendering', () => {
      const renderer = new TestRenderer((_props, session) => {
        session.setSharedContext('foo', 123);
        return session;
      });

      SESSION: {
        const session = renderer.render({});

        expect(session.getSharedContext('foo')).toBe(undefined);
      }
    });

    it('throws an error when trying to set a shared context outside of rendering', () => {
      const renderer = new TestRenderer((_props, session) => session);

      expect(() => {
        const session = renderer.render({});
        session.setSharedContext('foo', 123);
      }).toThrow(TypeError);
    });
  });

  describe('finalize()', () => {
    it('denies using a hook after finalize', () => {
      const renderer = new TestRenderer((_props, session) => session);
      const session = renderer.render({});

      expect(() => session.useState(0)).toThrow(TypeError);
    });

    it('throws an error if a different type of hook is given', () => {
      const renderer = new TestRenderer(
        ({ tick }: { tick: number }, session) => {
          if (tick === 0) {
            session.useEffect(() => {});
          } else if (tick === 1) {
            session.finalize();
          }
        },
      );

      renderer.render({ tick: 0 });

      expect(() => {
        renderer.render({ tick: 1 });
      }).toThrow('Unexpected hook type.');
    });
  });

  describe('forceUpdate()', () => {
    it('schedules an update with the current coroutine', async () => {
      let handle: UpdateHandle | undefined;

      const renderer = new TestRenderer((_props, session) => {
        session.useEffect(() => {
          handle = session.forceUpdate({ priority: 'background' });
        }, []);
      });
      const scheduleUpdateSpy = vi.spyOn(renderer.runtime, 'scheduleUpdate');

      renderer.render({});

      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(2);
      expect(scheduleUpdateSpy).toHaveBeenNthCalledWith(2, expect.any(Object), {
        priority: 'background',
      });

      expect(await handle?.scheduled).toStrictEqual({
        canceled: false,
        done: true,
      });
      expect(await handle?.finished).toStrictEqual({
        canceled: false,
        done: true,
      });
    });

    it('renders the session again if rendering is running', async () => {
      let handle: UpdateHandle | undefined;

      const renderer = new TestRenderer((_props, session) => {
        const [count, setCount] = session.useState(0);

        if (count === 0) {
          handle = setCount(count + 1);
        }

        return count;
      });
      const scheduleUpdateSpy = vi.spyOn(renderer.runtime, 'scheduleUpdate');

      const count = renderer.render({});

      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
      expect(count).toBe(1);
      expect(await handle?.scheduled).toStrictEqual({
        canceled: true,
        done: true,
      });
      expect(await handle?.finished).toStrictEqual({
        canceled: false,
        done: true,
      });
    });

    it('should do nothing if the coroutine is detached', async () => {
      let handle: UpdateHandle | undefined;

      const renderer = new TestRenderer(
        (_props, session) => {
          const [count, setCount] = session.useState(0);

          session.useEffect(() => {
            handle = setCount(1);
          }, []);
          return count;
        },
        { hooks: [], pendingLanes: Lane.NoLane, scope: DETACHED_SCOPE },
      );
      const scheduleUpdateSpy = vi.spyOn(renderer.runtime, 'scheduleUpdate');

      const count = renderer.render({});

      expect(count).toBe(0);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
      expect(await handle?.scheduled).toStrictEqual({
        canceled: true,
        done: false,
      });
      expect(await handle?.finished).toStrictEqual({
        canceled: true,
        done: false,
      });
    });
  });

  describe('html()', () => {
    it('returns a bindable with the HTML template', () => {
      const renderer = new TestRenderer(
        (_props, session) => session.html`<div>Hello, ${'World'}!</div>`,
      );
      const directive = renderer.render({});

      expect(directive.type).toBeInstanceOf(MockTemplate);
      expect(directive.type).toStrictEqual(
        expect.objectContaining({
          strings: ['<div>Hello, ', '!</div>'],
          values: ['World'],
          mode: 'html',
        }),
      );
      expect(directive.value).toStrictEqual(['World']);
    });
  });

  describe('math()', () => {
    it('returns a bindable with the MathML template', () => {
      const renderer = new TestRenderer(
        (_props, session) => session.math`<mi>${'x'}</mi>`,
      );
      const directive = renderer.render({});

      expect(directive.type).toBeInstanceOf(MockTemplate);
      expect(directive.type).toStrictEqual(
        expect.objectContaining({
          strings: ['<mi>', '</mi>'],
          values: ['x'],
          mode: 'math',
        }),
      );
      expect(directive.value).toStrictEqual(['x']);
    });
  });

  describe('svg()', () => {
    it('returns a bindable with the SVG template', () => {
      const renderer = new TestRenderer(
        (_props, session) => session.svg`<text>Hello, ${'World'}!</text>`,
      );
      const directive = renderer.render({});

      expect(directive.type).toBeInstanceOf(MockTemplate);
      expect(directive.type).toStrictEqual(
        expect.objectContaining({
          strings: ['<text>Hello, ', '!</text>'],
          values: ['World'],
          mode: 'svg',
        }),
      );
      expect(directive.value).toStrictEqual(['World']);
    });
  });

  describe('text()', () => {
    it('returns a bindable with the text template', () => {
      const renderer = new TestRenderer(
        (_props, session) => session.text`<div>Hello, ${'World'}!</div>`,
      );
      const directive = renderer.render({});

      expect(directive.type).toBeInstanceOf(MockTemplate);
      expect(directive.type).toStrictEqual(
        expect.objectContaining({
          strings: ['<div>Hello, ', '!</div>'],
          values: ['World'],
          mode: 'textarea',
        }),
      );
      expect(directive.value).toStrictEqual(['World']);
    });
  });

  describe('use()', () => {
    it('performs a custom hook function', () => {
      const renderer = new TestRenderer((_props, session) => session.use(hook));
      const hook = vi.fn().mockReturnValue('foo');

      const result = renderer.render({});

      expect(result).toBe('foo');
      expect(hook).toHaveBeenCalledOnce();
      expect(hook).toHaveBeenCalledWith(expect.any(RenderSession));
    });

    it('performs a custom hook object', () => {
      const renderer = new TestRenderer((_props, session) => session.use(hook));
      const hook = {
        [$hook]: vi.fn().mockReturnValue('foo'),
      };

      const result = renderer.render({});

      expect(result).toBe('foo');
      expect(hook[$hook]).toHaveBeenCalledOnce();
      expect(hook[$hook]).toHaveBeenCalledWith(expect.any(RenderSession));
    });
  });

  describe('useCallback()', () => {
    it('returns the memoized callback if dependencies are the same as the previous value', () => {
      const renderer = new TestRenderer(
        (
          {
            callback,
            dependencies,
          }: { callback: () => void; dependencies: unknown[] },
          session,
        ) => {
          return session.useCallback(callback, dependencies);
        },
      );
      const callback1 = () => {};
      const callback2 = () => {};

      SESSION1: {
        const callback = renderer.render({
          callback: callback1,
          dependencies: ['foo'],
        });

        expect(callback).toBe(callback1);
      }

      SESSION2: {
        const callback = renderer.render({
          callback: callback2,
          dependencies: ['foo'],
        });

        expect(callback).toBe(callback1);
      }

      SESSION3: {
        const callback = renderer.render({
          callback: callback2,
          dependencies: ['bar'],
        });

        expect(callback).toBe(callback2);
      }
    });
  });

  describe.each([
    ['useEffect', CommitPhase.Passive],
    ['useLayoutEffect', CommitPhase.Layout],
    ['useInsertionEffect', CommitPhase.Mutation],
  ] as const)('useEffect()', (hookName, phase) => {
    it('cleans up the previous effect', () => {
      const renderer = new TestRenderer((_props, session) => {
        session[hookName](callback);
      });

      const cleanup = vi.fn();
      const callback = vi.fn().mockReturnValue(cleanup);
      const flushEffectsSpy = vi.spyOn(
        renderer.runtime['_backend'],
        'flushEffects',
      );

      SESSION1: {
        renderer.render({});

        expect(callback).toHaveBeenCalledTimes(1);
        expect(cleanup).toHaveBeenCalledTimes(0);
        expect(flushEffectsSpy).toHaveBeenCalledTimes(1);
        expect(flushEffectsSpy).toHaveBeenCalledWith(
          expect.any(EffectQueue),
          phase,
        );
      }

      SESSION2: {
        renderer.render({});

        expect(callback).toHaveBeenCalledTimes(2);
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(flushEffectsSpy).toHaveBeenCalledTimes(2);
        expect(flushEffectsSpy).toHaveBeenCalledWith(
          expect.any(EffectQueue),
          phase,
        );
      }
    });

    it('does not perform the callback function if dependencies are not changed', () => {
      const renderer = new TestRenderer(
        (
          {
            callback,
            dependencies,
          }: { callback: () => void; dependencies: unknown[] },
          session,
        ) => {
          session[hookName](callback, dependencies);
        },
      );

      const callback = vi.fn();
      const flushEffectsSpy = vi.spyOn(
        renderer.runtime['_backend'],
        'flushEffects',
      );

      SESSION1: {
        renderer.render({ callback, dependencies: ['foo'] });

        expect(callback).toHaveBeenCalledTimes(1);
        expect(flushEffectsSpy).toHaveBeenCalledTimes(1);
        expect(flushEffectsSpy).toHaveBeenCalledWith(
          expect.any(EffectQueue),
          phase,
        );
      }

      SESSION2: {
        renderer.render({ callback, dependencies: ['foo'] });

        expect(callback).toHaveBeenCalledTimes(1);
        expect(flushEffectsSpy).toHaveBeenCalledTimes(1);
      }

      SESSION3: {
        renderer.render({ callback, dependencies: ['bar'] });

        expect(callback).toHaveBeenCalledTimes(2);
        expect(flushEffectsSpy).toHaveBeenCalledTimes(2);
        expect(flushEffectsSpy).toHaveBeenCalledWith(
          expect.any(EffectQueue),
          phase,
        );
      }
    });

    it('throws an error if given a different type of hook', () => {
      const renderer = new TestRenderer(
        ({ tick }: { tick: number }, session) => {
          if (tick === 1) {
            session[hookName](() => {});
          }
        },
      );

      renderer.render({ tick: 0 });

      expect(() => {
        renderer.render({ tick: 1 });
      }).toThrow('Unexpected hook type.');
    });
  });

  describe('useId()', () => {
    it('returns a unique identifier', () => {
      const renderer = new TestRenderer((_props, session) => {
        return [session.useId(), session.useId()] as const;
      });

      let id1: string;
      let id2: string;
      let id3: string;
      let id4: string;

      SESSION1: {
        [id1, id2] = renderer.render({});

        expect(id1).not.toBe(id2);
      }

      SESSION2: {
        [id3, id4] = renderer.render({});

        expect(id1).toBe(id3);
        expect(id2).toBe(id4);
      }
    });

    it('throws an error if given a different type of hook', () => {
      const renderer = new TestRenderer(
        ({ tick }: { tick: number }, session) => {
          if (tick === 1) {
            session.useId();
          }
        },
      );

      renderer.render({ tick: 0 });

      expect(() => {
        renderer.render({ tick: 1 });
      }).toThrow('Unexpected hook type.');
    });
  });

  describe('useMemo()', () => {
    it('returns the memoized value if dependencies are the same as the previous value', () => {
      const renderer = new TestRenderer(
        (
          {
            factory,
            dependencies,
          }: { factory: () => string; dependencies: unknown[] },
          session,
        ) => {
          return session.useMemo(factory, dependencies);
        },
      );

      SESSION1: {
        const value = renderer.render({
          factory: () => 'foo',
          dependencies: ['foo'],
        });

        expect(value).toBe('foo');
      }

      SESSION2: {
        const value = renderer.render({
          factory: () => 'bar',
          dependencies: ['foo'],
        });

        expect(value).toBe('foo');
      }

      SESSION3: {
        const value = renderer.render({
          factory: () => 'bar',
          dependencies: ['bar'],
        });

        expect(value).toBe('bar');
      }
    });

    it('throws an error if given a different type of hook', () => {
      const renderer = new TestRenderer(
        ({ tick }: { tick: number }, session) => {
          if (tick === 1) {
            session.useMemo(() => null, []);
          }
        },
      );

      renderer.render({ tick: 0 });

      expect(() => {
        renderer.render({ tick: 1 });
      }).toThrow('Unexpected hook type.');
    });
  });

  describe('useReducer()', () => {
    it('schedules the update when the state is changed', async () => {
      const renderer = new TestRenderer(
        vi.fn((_props, session: RenderContext) => {
          const [count, increment] = session.useReducer<number, number>(
            (count, delta) => count + delta,
            0,
          );

          session.useEffect(() => {
            increment(1);
          }, []);

          return count;
        }),
      );

      SESSION: {
        renderer.render({});

        expect(renderer.callback).toHaveBeenCalledTimes(1);
        expect(renderer.callback).toHaveLastReturnedWith(0);
      }

      await waitForMicrotasks(2);

      expect(renderer.callback).toHaveBeenCalledTimes(2);
      expect(renderer.callback).toHaveLastReturnedWith(1);
    });

    it('should skip the update if the state does not changed', async () => {
      const renderer = new TestRenderer(
        vi.fn((_props, session: RenderContext) => {
          const [count, increment] = session.useReducer<number, number>(
            (count, delta) => count + delta,
            0,
          );

          session.useEffect(() => {
            increment(0);
          }, []);

          return count;
        }),
      );

      SESSION: {
        renderer.render(renderer.callback);

        expect(renderer.callback).toHaveBeenCalledTimes(1);
        expect(renderer.callback).toHaveLastReturnedWith(0);
      }
    });

    it('returns an initial state by the function', () => {
      const renderer = new TestRenderer(
        vi.fn((_props, session: RenderContext) => {
          const [count] = session.useReducer<number, number>(
            (count, delta) => count + delta,
            0,
          );
          return count;
        }),
      );

      SESSION: {
        const count = renderer.render({});

        expect(count).toBe(0);
      }
    });

    it('throws an error if given a different type of hook', () => {
      const renderer = new TestRenderer(
        ({ tick }: { tick: number }, session) => {
          if (tick === 1) {
            session.useReducer<number, number>((count, n) => count + n, 0);
          }
        },
      );

      renderer.render({ tick: 0 });

      expect(() => {
        renderer.render({ tick: 1 });
      }).toThrow('Unexpected hook type.');
    });
  });

  describe('useRef()', () => {
    it('returns a memoized ref object', () => {
      const renderer = new TestRenderer(
        ({ value }: { value: string }, session) => session.useRef(value),
      );

      let ref1: RefObject<string>;
      let ref2: RefObject<string>;

      SESSION1: {
        ref1 = renderer.render({ value: 'foo' });

        expect(ref1).toStrictEqual({ current: 'foo' });
      }

      SESSION2: {
        ref2 = renderer.render({ value: 'bar' });

        expect(ref2).toStrictEqual(ref1);
      }
    });
  });

  describe('useState()', () => {
    it('schedules the update when the state is changed', async () => {
      const renderer = new TestRenderer(
        vi.fn((_props, session: RenderContext) => {
          const [count, setCount] = session.useState(0);

          session.useEffect(() => {
            setCount(1);
          });

          return count;
        }),
      );

      SESSION1: {
        renderer.render({});

        expect(renderer.callback).toHaveBeenCalledTimes(1);
        expect(renderer.callback).toHaveLastReturnedWith(0);
      }

      await waitForMicrotasks(2);

      expect(renderer.callback).toHaveBeenCalledTimes(2);
      expect(renderer.callback).toHaveLastReturnedWith(1);
    });

    it('compares each state with a custom equality', async () => {
      const renderer = new TestRenderer(
        vi.fn((_props, session: RenderContext) => {
          const [range, setRange] = session.useState({ start: 0, end: 1 });

          session.useEffect(() => {
            setRange({ start: 0, end: 1 }, { areStatesEqual: shallowEqual });
          });

          return range;
        }),
      );

      SESSION1: {
        renderer.render({});

        expect(renderer.callback).toHaveBeenCalledTimes(1);
        expect(renderer.callback).toHaveLastReturnedWith({ start: 0, end: 1 });
      }
    });

    it('calculates a new state from the previous state', async () => {
      const renderer = new TestRenderer(
        vi.fn((_props, session: RenderContext) => {
          const [count, setCount] = session.useState(() => 0);

          session.useEffect(() => {
            setCount((count) => count + 1);
            setCount((count) => count + 1);
          }, []);

          return count;
        }),
      );

      SESSION: {
        renderer.render({});

        expect(renderer.callback).toHaveBeenCalledTimes(1);
        expect(renderer.callback).toHaveLastReturnedWith(0);
      }

      await waitForMicrotasks(2);

      expect(renderer.callback).toHaveBeenCalledTimes(2);
      expect(renderer.callback).toHaveLastReturnedWith(2);
    });

    it('should not return the pending state', async () => {
      const renderer = new TestRenderer(
        vi.fn((_props, session: RenderContext) => {
          const [count, setCount, isPending] = session.useState(() => 0);

          session.useEffect(() => {
            setCount(1, { priority: 'background' });
          }, []);

          return [count, isPending];
        }),
      );

      SESSION1: {
        renderer.render({});

        expect(renderer.callback).toHaveBeenCalledTimes(1);
        expect(renderer.callback).toHaveNthReturnedWith(1, [0, false]);
      }

      SESSION2: {
        renderer.render({});

        expect(renderer.callback).toHaveBeenCalledTimes(2);
        expect(renderer.callback).toHaveNthReturnedWith(2, [0, true]);
      }

      await waitForTimeout(1);

      expect(renderer.callback).toHaveBeenCalledTimes(3);
      expect(renderer.callback).toHaveNthReturnedWith(3, [1, false]);
    });
  });
});
