import { describe, expect, it, vi } from 'vitest';
import { $customHook, Lanes, Literal, type RefObject } from '@/core.js';
import { RenderSession } from '@/render-session.js';
import { Runtime } from '@/runtime.js';
import { MockBackend, MockCoroutine, MockTemplate } from '../mocks.js';
import { disposeSession, flushSession, waitForUpdate } from '../test-utils.js';

describe('RenderSession', () => {
  describe('dynamicHTML()', () => {
    it('returns a bindable with the dynamic HTML template', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const bindable = session.dynamicHTML`<${new Literal('div')}>Hello, ${'World'}!</${new Literal('div')}>`;

      expect(bindable.type).toBeInstanceOf(MockTemplate);
      expect(bindable.type).toStrictEqual(
        expect.objectContaining({
          strings: ['<div>Hello, ', '!</div>'],
          binds: ['World'],
          mode: 'html',
        }),
      );
      expect(bindable.value).toStrictEqual(['World']);
    });
  });

  describe('dynamicMath()', () => {
    it('returns a bindable with the dynamic MathML template', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const bindable = session.dynamicMath`<${new Literal('mi')}>${'x'}</${new Literal('mi')}>`;

      expect(bindable.type).toBeInstanceOf(MockTemplate);
      expect(bindable.type).toStrictEqual(
        expect.objectContaining({
          strings: ['<mi>', '</mi>'],
          binds: ['x'],
          mode: 'math',
        }),
      );
      expect(bindable.value).toStrictEqual(['x']);
    });
  });

  describe('dynamicSVG()', () => {
    it('returns a bindable with the dynamic SVG template', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const bindable = session.dynamicSVG`<${new Literal('text')}>Hello, ${'World'}!</${new Literal('text')}>`;

      expect(bindable.type).toBeInstanceOf(MockTemplate);
      expect(bindable.type).toStrictEqual(
        expect.objectContaining({
          strings: ['<text>Hello, ', '!</text>'],
          binds: ['World'],
          mode: 'svg',
        }),
      );
      expect(bindable.value).toStrictEqual(['World']);
    });
  });

  describe('getContextValue()', () => {
    it.each([['foo'], [Symbol('bar')], [{}]])(
      'returns a session value by the key',
      (key) => {
        const session = new RenderSession(
          [],
          Lanes.AllLanes,
          new MockCoroutine(),
          new Runtime(new MockBackend()),
        );

        expect(session.getContextValue(key)).toBe(undefined);

        session.setContextValue(key, 123);

        expect(session.getContextValue(key)).toBe(123);

        session.setContextValue(key, 456);

        expect(session.getContextValue(key)).toBe(456);
      },
    );
  });

  describe('finalize()', () => {
    it('denies using a hook after finalize', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      session.finalize();

      expect(() => session.useState(0)).toThrow();
    });

    it('throws an error if given a different type of hook', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      session.useEffect(() => {});

      flushSession(session);

      expect(() => session.finalize()).toThrow('Unexpected hook type.');
    });
  });

  describe('forceUpdate()', () => {
    it('schedules the update with the current coroutine', async () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const options = { priority: 'background' } as const;

      const scheduleUpdateSpy = vi
        .spyOn(session['_context'], 'scheduleUpdate')
        .mockImplementation(() => ({
          lanes: Lanes.BackgroundLane,
          promise: Promise.resolve(),
        }));

      await session.forceUpdate(options).promise;

      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
      expect(scheduleUpdateSpy).toHaveBeenCalledWith(
        session['_coroutine'],
        options,
      );
    });
  });

  describe('html()', () => {
    it('returns a bindable with the HTML template', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const bindable = session.html`<div>Hello, ${'World'}!</div>`;

      expect(bindable.type).toBeInstanceOf(MockTemplate);
      expect(bindable.type).toStrictEqual(
        expect.objectContaining({
          strings: ['<div>Hello, ', '!</div>'],
          binds: ['World'],
          mode: 'html',
        }),
      );
      expect(bindable.value).toStrictEqual(['World']);
    });
  });

  describe('math()', () => {
    it('returns a bindable with the MathML template', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const bindable = session.math`<mi>${'x'}</mi>`;

      expect(bindable.type).toBeInstanceOf(MockTemplate);
      expect(bindable.type).toStrictEqual(
        expect.objectContaining({
          strings: ['<mi>', '</mi>'],
          binds: ['x'],
          mode: 'math',
        }),
      );
      expect(bindable.value).toStrictEqual(['x']);
    });
  });

  describe('svg()', () => {
    it('returns a bindable with the SVG template', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const bindable = session.svg`<text>Hello, ${'World'}!</text>`;

      expect(bindable.type).toBeInstanceOf(MockTemplate);
      expect(bindable.type).toStrictEqual(
        expect.objectContaining({
          strings: ['<text>Hello, ', '!</text>'],
          binds: ['World'],
          mode: 'svg',
        }),
      );
      expect(bindable.value).toStrictEqual(['World']);
    });
  });

  describe('text()', () => {
    it('returns a bindable with the text template', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const bindable = session.text`<div>Hello, ${'World'}!</div>`;

      expect(bindable.type).toBeInstanceOf(MockTemplate);
      expect(bindable.type).toStrictEqual(
        expect.objectContaining({
          strings: ['<div>Hello, ', '!</div>'],
          binds: ['World'],
          mode: 'textarea',
        }),
      );
      expect(bindable.value).toStrictEqual(['World']);
    });
  });

  describe('use()', () => {
    it('performs the custom hook', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const result = 'foo';
      const hook = {
        [$customHook]: vi.fn().mockReturnValue(result),
      };

      expect(session.use(hook)).toBe(result);
      expect(hook[$customHook]).toHaveBeenCalledOnce();
      expect(hook[$customHook]).toHaveBeenCalledWith(session);
    });
  });

  describe('useCallback()', () => {
    it('returns the memoized callback if dependencies are the same as the previous value', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const callback1 = () => {};
      const callback2 = () => {};

      SESSION1: {
        expect(session.useCallback(callback1, ['foo'])).toBe(callback1);

        flushSession(session);
      }

      SESSION2: {
        expect(session.useCallback(callback2, ['foo'])).toBe(callback1);

        flushSession(session);
      }

      SESSION3: {
        expect(session.useCallback(callback2, ['bar'])).toBe(callback2);

        flushSession(session);
      }
    });
  });

  describe('useDeferredValue()', async () => {
    it('returns the value deferred until next rendering', async () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const value1 = 'foo';
      const value2 = 'bar';

      const scheduleUpdateSpy = vi.spyOn(session['_context'], 'scheduleUpdate');

      SESSION1: {
        expect(session.useDeferredValue(value1)).toBe(value1);

        flushSession(session);
      }

      expect(await waitForUpdate(session)).toBe(0);
      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      SESSION2: {
        expect(session.useDeferredValue(value2)).toBe(value1);

        flushSession(session);
      }

      expect(await waitForUpdate(session)).toBe(1);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
      expect(scheduleUpdateSpy).toHaveBeenCalledWith(session['_coroutine'], {
        priority: 'background',
      });

      SESSION3: {
        expect(session.useDeferredValue(value2)).toBe(value2);

        flushSession(session);
      }

      expect(await waitForUpdate(session)).toBe(0);
      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    });

    it('returns the initial value if it is given', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const value1 = 'foo';
      const value2 = 'bar';

      const scheduleUpdateSpy = vi.spyOn(session['_context'], 'scheduleUpdate');

      SESSION1: {
        expect(session.useDeferredValue(value2, value1)).toBe(value1);

        flushSession(session);
      }

      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
      expect(scheduleUpdateSpy).toHaveBeenCalledWith(session['_coroutine'], {
        priority: 'background',
      });

      SESSION2: {
        expect(session.useDeferredValue(value2, value1)).toBe(value2);

        flushSession(session);
      }

      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    });
  });

  describe.each([
    ['useEffect', 'enqueuePassiveEffect'],
    ['useLayoutEffect', 'enqueueLayoutEffect'],
    ['useInsertionEffect', 'enqueueMutationEffect'],
  ] as const)('useEffect()', (hookMethod, enqueueMethod) => {
    it('performs the cleanup function when the callback is changed', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      const cleanup = vi.fn();
      const callback = vi.fn().mockReturnValue(cleanup);
      const enqueueEffectSpy = vi.spyOn(session['_context'], enqueueMethod);

      SESSION1: {
        session[hookMethod](callback);

        flushSession(session);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(cleanup).toHaveBeenCalledTimes(0);
      }

      SESSION2: {
        session[hookMethod](callback);

        flushSession(session);

        expect(callback).toHaveBeenCalledTimes(2);
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(enqueueEffectSpy).toHaveBeenCalledTimes(2);
      }
    });

    it('does not perform the callback function if dependencies are not changed', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      const callback = vi.fn();
      const enqueueEffectSpy = vi.spyOn(session['_context'], enqueueMethod);

      SESSION1: {
        session[hookMethod](callback, ['foo']);

        flushSession(session);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(enqueueEffectSpy).toHaveBeenCalledTimes(1);
      }

      SESSION2: {
        session[hookMethod](callback, ['foo']);

        flushSession(session);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(enqueueEffectSpy).toHaveBeenCalledTimes(1);
      }

      SESSION3: {
        session[hookMethod](callback, ['bar']);

        flushSession(session);

        expect(callback).toHaveBeenCalledTimes(2);
        expect(enqueueEffectSpy).toHaveBeenCalledTimes(2);
      }
    });

    it('throws an error if given a different type of hook', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      flushSession(session);

      expect(() => session[hookMethod](() => {})).toThrow(
        'Unexpected hook type.',
      );
    });
  });

  describe('useId()', () => {
    it('returns a unique identifier', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      let id1: string;
      let id2: string;

      SESSION1: {
        id1 = session.useId();
        id2 = session.useId();

        expect(id1).toMatch(/[0-9a-z]+:1/);
        expect(id2).toMatch(/[0-9a-z]+:2/);

        flushSession(session);
      }

      SESSION2: {
        expect(session.useId()).toBe(id1);
        expect(session.useId()).toBe(id2);

        flushSession(session);
      }
    });

    it('throws an error if given a different type of hook', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      flushSession(session);

      expect(() => session.useId()).toThrow('Unexpected hook type.');
    });
  });

  describe('useMemo()', () => {
    it('returns the memoized value if dependencies are the same as the previous value', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const value1 = 'foo';
      const value2 = 'bar';

      SESSION1: {
        expect(session.useMemo(() => value1, ['foo'])).toBe(value1);

        flushSession(session);
      }

      SESSION2: {
        expect(session.useMemo(() => value2, ['foo'])).toBe(value1);

        flushSession(session);
      }

      SESSION3: {
        expect(session.useMemo(() => value2, ['bar'])).toBe(value2);

        flushSession(session);
      }
    });

    it('throws an error if given a different type of hook', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      flushSession(session);

      expect(() => session.useMemo(() => null, [])).toThrow(
        'Unexpected hook type.',
      );
    });
  });

  describe('useReducer()', () => {
    it('schedules the update when the state is changed', async () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const reducer = (count: number, n: number) => count + n;

      SESSION1: {
        const [count, increment] = session.useReducer(reducer, 0);

        session.useEffect(() => {
          increment(1);
        }, []);

        flushSession(session);

        expect(count).toBe(0);
      }

      expect(await waitForUpdate(session)).toBe(1);

      SESSION2: {
        const [count, increment] = session.useReducer(reducer, 0);

        session.useEffect(() => {
          increment(1);
        }, []);

        flushSession(session);

        expect(count).toBe(1);
      }

      expect(await waitForUpdate(session)).toBe(0);
    });

    it('should skip the update if the state does not changed', async () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const reducer = (count: number, n: number) => count + n;

      SESSION1: {
        const [count, increment] = session.useReducer(reducer, 0);

        session.useEffect(() => {
          increment(0);
        }, []);

        flushSession(session);

        expect(count).toBe(0);
      }

      expect(await waitForUpdate(session)).toBe(0);
    });

    it('returns the initial state by the function', async () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const reducer = (count: number, n: number) => count + n;

      const [count] = session.useReducer(reducer, () => 0);

      flushSession(session);

      expect(count).toBe(0);
    });

    it('throws an error if given a different type of hook', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      flushSession(session);

      expect(() =>
        session.useReducer<number, number>((count, n) => count + n, 0),
      ).toThrow('Unexpected hook type.');
    });
  });

  describe('useRef()', () => {
    it('returns a memoized ref object', () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      let ref: RefObject<string>;

      SESSION1: {
        ref = session.useRef('foo');

        expect(ref).toStrictEqual({ current: 'foo' });

        flushSession(session);
      }

      SESSION2: {
        expect(session.useRef('bar')).toBe(ref);

        flushSession(session);
      }
    });
  });

  describe('useState()', () => {
    it('schedules the update when the state is changed', async () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      SESSION1: {
        const [count, setCount] = session.useState(0);

        session.useEffect(() => {
          setCount(1);
        }, []);

        flushSession(session);

        expect(count).toBe(0);
      }

      expect(await waitForUpdate(session)).toBe(1);

      SESSION2: {
        const [count, setCount] = session.useState(0);

        session.useEffect(() => {
          setCount(1);
        }, []);

        flushSession(session);

        expect(count).toBe(1);
      }

      expect(await waitForUpdate(session)).toBe(0);
    });

    it('should skip the update if the state does not changed', async () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      SESSION1: {
        const [count, setCount] = session.useState(0);

        session.useEffect(() => {
          setCount(0);
        }, []);

        flushSession(session);

        expect(count).toBe(0);
      }

      expect(await waitForUpdate(session)).toBe(0);
    });

    it('sets a new state from the old one', async () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      SESSION1: {
        const [count, setCount] = session.useState(() => 0);

        session.useEffect(() => {
          // Call twice and the result is the same.
          setCount((count) => count + 1);
          setCount((count) => count + 1);
        }, []);

        flushSession(session);

        expect(count).toBe(0);
      }

      expect(await waitForUpdate(session)).toBe(1);

      SESSION2: {
        const [count, setCount] = session.useState(0);

        session.useEffect(() => {
          setCount((count) => count + 1);
          setCount((count) => count + 1);
        }, []);

        flushSession(session);

        expect(count).toBe(1);
      }

      expect(await waitForUpdate(session)).toBe(0);
    });

    it('should not return the pending state', async () => {
      const session = new RenderSession(
        [],
        Lanes.UserBlockingLane,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      SESSION1: {
        const [count, setCount, isPending] = session.useState(() => 0);

        session.useEffect(() => {
          setCount(1, { priority: 'background' });
        }, []);

        expect(flushSession(session)).toBe(Lanes.NoLanes);

        expect(count).toBe(0);
        expect(isPending).toBe(false);
      }

      expect(await waitForUpdate(session)).toBe(1);

      SESSION2: {
        const [count, setCount, isPending] = session.useState(0);

        session.useEffect(() => {
          setCount(1, { priority: 'background' });
        }, []);

        expect(count).toBe(0);
        expect(isPending).toBe(true);

        expect(flushSession(session)).toBe(Lanes.BackgroundLane);
      }

      expect(await waitForUpdate(session)).toBe(0);
    });
  });

  describe('useSyncExternalStore()', () => {
    it('forces the update if the snapshot is changed when the store is updated', async () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const subscribers = new Set<() => void>();
      let snapshot = 0;

      const subscribe = (subscriber: () => void) => {
        subscribers.add(subscriber);
        return () => {
          subscribers.delete(subscriber);
        };
      };
      const getSnapshot = () => snapshot;
      const notifySubscribers = () => {
        snapshot++;
        for (const subscriber of subscribers) {
          subscriber();
        }
      };

      SESSION1: {
        expect(session.useSyncEnternalStore(subscribe, getSnapshot)).toBe(0);

        session.useEffect(notifySubscribers, []);

        flushSession(session);
      }

      expect(await waitForUpdate(session)).toBe(1);
      expect(subscribers.size).toBe(1);

      SESSION2: {
        expect(session.useSyncEnternalStore(subscribe, getSnapshot)).toBe(1);

        session.useEffect(notifySubscribers, []);

        flushSession(session);
      }

      expect(await waitForUpdate(session)).toBe(0);

      disposeSession(session);

      expect(subscribers.size).toBe(0);
    });

    it('forces the update if the snapshot have been changed during update', async () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      let count = 0;

      const unsubscribe = vi.fn();
      const subscribe = vi.fn().mockReturnValue(unsubscribe);
      const getSnapshot = () => count;

      SESSION1: {
        expect(session.useSyncEnternalStore(subscribe, getSnapshot)).toBe(0);

        session.useLayoutEffect(() => {
          count++;
        });

        flushSession(session);
      }

      expect(await waitForUpdate(session)).toBe(1);
      expect(subscribe).toHaveBeenCalledOnce();
      expect(unsubscribe).not.toHaveBeenCalled();

      SESSION2: {
        expect(session.useSyncEnternalStore(subscribe, getSnapshot)).toBe(1);

        session.useLayoutEffect(() => {
          count++;
        });

        flushSession(session);
      }

      expect(await waitForUpdate(session)).toBe(0);
      expect(subscribe).toHaveBeenCalledOnce();
      expect(unsubscribe).not.toHaveBeenCalled();

      disposeSession(session);

      expect(subscribe).toHaveBeenCalledOnce();
      expect(unsubscribe).toHaveBeenCalledOnce();
    });

    it('should resubscribe the store if the subscribe function is changed', async () => {
      const session = new RenderSession(
        [],
        Lanes.AllLanes,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      const unsubscribe1 = vi.fn();
      const unsubscribe2 = vi.fn();
      const subscribe1 = vi.fn().mockReturnValue(unsubscribe1);
      const subscribe2 = vi.fn().mockReturnValue(unsubscribe2);
      const getSnapshot1 = () => 'foo';
      const getSnapshot2 = () => 'bar';

      SESSION1: {
        expect(session.useSyncEnternalStore(subscribe1, getSnapshot1)).toBe(
          'foo',
        );

        flushSession(session);
      }

      expect(await waitForUpdate(session)).toBe(0);
      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(0);
      expect(unsubscribe1).toHaveBeenCalledTimes(0);
      expect(unsubscribe2).toHaveBeenCalledTimes(0);

      SESSION2: {
        expect(session.useSyncEnternalStore(subscribe2, getSnapshot1)).toBe(
          'foo',
        );

        flushSession(session);
      }

      expect(await waitForUpdate(session)).toBe(0);
      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(1);
      expect(unsubscribe1).toHaveBeenCalledTimes(1);
      expect(unsubscribe2).toHaveBeenCalledTimes(0);

      SESSION3: {
        expect(session.useSyncEnternalStore(subscribe2, getSnapshot2)).toBe(
          'bar',
        );

        flushSession(session);
      }

      expect(await waitForUpdate(session)).toBe(0);
      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(1);
      expect(unsubscribe1).toHaveBeenCalledTimes(1);
      expect(unsubscribe2).toHaveBeenCalledTimes(0);

      disposeSession(session);

      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(1);
      expect(unsubscribe1).toHaveBeenCalledTimes(1);
      expect(unsubscribe2).toHaveBeenCalledTimes(1);
    });
  });
});
