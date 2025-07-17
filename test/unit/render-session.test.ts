import { describe, expect, it, vi } from 'vitest';
import { ALL_LANES, Lane, NO_LANES } from '@/core.js';
import { RenderSession } from '@/render-session.js';
import { Runtime } from '@/runtime.js';
import { Literal } from '@/template-literal.js';
import { MockBackend, MockCoroutine, MockTemplate } from '../mocks.js';
import { cleanupHooks } from '../test-utils.js';

describe('RenderSession', () => {
  describe('dynamicHTML()', () => {
    it('returns a bindable with the dynamic HTML template', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
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
        ALL_LANES,
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
        ALL_LANES,
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
          ALL_LANES,
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
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      session.finalize();

      expect(() => session.useState(0)).toThrow();
    });

    it('throws an error if given a different type of hook', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      session.useEffect(() => {});
      session.finalize();
      session.flush();

      expect(() => session.finalize()).toThrow('Unexpected hook type.');
    });
  });

  describe('forceUpdate()', () => {
    it('schedules the update with the current coroutine', async () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const options = { priority: 'background' } as const;

      const scheduleUpdateSpy = vi
        .spyOn(session['_context'], 'scheduleUpdate')
        .mockImplementation(() => ({
          lanes: Lane.Background,
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
        ALL_LANES,
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
        ALL_LANES,
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
        ALL_LANES,
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
        ALL_LANES,
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
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const result = 'foo';
      const hook = {
        onCustomHook: vi.fn().mockReturnValue(result),
      };

      expect(session.use(hook)).toBe(result);
      expect(hook.onCustomHook).toHaveBeenCalledOnce();
      expect(hook.onCustomHook).toHaveBeenCalledWith(session);
    });
  });

  describe('useCallback()', () => {
    it('returns the memoized callback if dependencies are the same as the previous value', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const callback1 = () => {};
      const callback2 = () => {};

      expect(session.useCallback(callback1, ['foo'])).toBe(callback1);

      session.finalize();
      session.flush();

      expect(session.useCallback(callback2, ['foo'])).toBe(callback1);

      session.finalize();
      session.flush();

      expect(session.useCallback(callback2, ['bar'])).toBe(callback2);
    });
  });

  describe('useDeferredValue()', async () => {
    it('returns the value deferred until next rendering', async () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const value1 = 'foo';
      const value2 = 'bar';

      const scheduleUpdateSpy = vi.spyOn(session['_context'], 'scheduleUpdate');

      expect(session.useDeferredValue(value1)).toBe(value1);

      session.finalize();
      session.flush();

      expect(scheduleUpdateSpy).not.toHaveBeenCalled();

      expect(session.useDeferredValue(value2)).toBe(value1);

      session.finalize();
      session.flush();

      expect(await session.waitforUpdate()).toBe(1);

      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
      expect(scheduleUpdateSpy).toHaveBeenCalledWith(session['_coroutine'], {
        priority: 'background',
      });

      expect(session.useDeferredValue(value2)).toBe(value2);

      session.finalize();
      session.flush();

      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
    });

    it('returns the initial value if it is given', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const value1 = 'foo';
      const value2 = 'bar';

      const scheduleUpdateSpy = vi.spyOn(session['_context'], 'scheduleUpdate');

      expect(session.useDeferredValue(value2, value1)).toBe(value1);

      session.finalize();
      session.flush();

      expect(scheduleUpdateSpy).toHaveBeenCalledOnce();
      expect(scheduleUpdateSpy).toHaveBeenCalledWith(session['_coroutine'], {
        priority: 'background',
      });

      expect(session.useDeferredValue(value2, value1)).toBe(value2);

      session.finalize();
      session.flush();

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
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      const cleanup = vi.fn();
      const callback = vi.fn().mockReturnValue(cleanup);
      const enqueueEffectSpy = vi.spyOn(session['_context'], enqueueMethod);

      session[hookMethod](callback);

      session.finalize();
      session.flush();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(cleanup).toHaveBeenCalledTimes(0);

      session[hookMethod](callback);

      session.finalize();
      session.flush();

      expect(callback).toHaveBeenCalledTimes(2);
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(enqueueEffectSpy).toHaveBeenCalledTimes(2);
    });

    it('does not perform the callback function if dependencies are not changed', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      const callback = vi.fn();
      const enqueueEffectSpy = vi.spyOn(session['_context'], enqueueMethod);

      session[hookMethod](callback, ['foo']);

      session.finalize();
      session.flush();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(enqueueEffectSpy).toHaveBeenCalledTimes(1);

      session[hookMethod](callback, ['foo']);

      session.finalize();
      session.flush();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(enqueueEffectSpy).toHaveBeenCalledTimes(1);

      session[hookMethod](callback, ['bar']);

      session.finalize();
      session.flush();

      expect(callback).toHaveBeenCalledTimes(2);
      expect(enqueueEffectSpy).toHaveBeenCalledTimes(2);
    });

    it('throws an error if given a different type of hook', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      session.finalize();
      session.flush();

      expect(() => session[hookMethod](() => {})).toThrow(
        'Unexpected hook type.',
      );
    });
  });

  describe('useId()', () => {
    it('returns a unique identifier', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      const id1 = session.useId();
      const id2 = session.useId();

      expect(id1).toMatch(/[0-9a-z]+:1/);
      expect(id2).toMatch(/[0-9a-z]+:2/);

      session.finalize();
      session.flush();

      expect(session.useId()).toBe(id1);
      expect(session.useId()).toBe(id2);
    });

    it('throws an error if given a different type of hook', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      session.finalize();
      session.flush();

      expect(() => session.useId()).toThrow('Unexpected hook type.');
    });
  });

  describe('useMemo()', () => {
    it('returns the memoized value if dependencies are the same as the previous value', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const value1 = 'foo';
      const value2 = 'bar';

      expect(session.useMemo(() => value1, ['foo'])).toBe(value1);

      session.finalize();
      session.flush();

      expect(session.useMemo(() => value2, ['foo'])).toBe(value1);

      session.finalize();
      session.flush();

      expect(session.useMemo(() => value2, ['bar'])).toBe(value2);
    });

    it('throws an error if given a different type of hook', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      session.finalize();
      session.flush();

      expect(() => session.useMemo(() => null, [])).toThrow(
        'Unexpected hook type.',
      );
    });
  });

  describe('useReducer()', () => {
    it('schedules the update when the state is changed', async () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const reducer = (count: number, n: number) => count + n;

      let [count, increment] = session.useReducer(reducer, 0);

      session.finalize();
      session.flush();

      expect(count).toBe(0);

      expect(await session.waitforUpdate()).toBe(0);

      increment(1);

      expect(await session.waitforUpdate()).toBe(1);

      [count, increment] = session.useReducer(reducer, 0);

      session.finalize();
      session.flush();

      expect(count).toBe(1);
    });

    it('should skip the update if the state does not changed', async () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const reducer = (count: number, n: number) => count + n;

      let [count, increment] = session.useReducer(reducer, 0);

      session.finalize();
      session.flush();

      expect(count).toBe(0);

      expect(await session.waitforUpdate()).toBe(0);

      increment(0);

      expect(await session.waitforUpdate()).toBe(0);

      [count, increment] = session.useReducer(reducer, 0);

      session.finalize();
      session.flush();

      expect(count).toBe(0);
    });

    it('returns the initial state by the function', async () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      const reducer = (count: number, n: number) => count + n;

      const [count] = session.useReducer(reducer, () => 0);

      session.finalize();
      session.flush();

      expect(count).toBe(0);
    });

    it('throws an error if given a different type of hook', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      session.finalize();
      session.flush();

      expect(() =>
        session.useReducer<number, number>((count, n) => count + n, 0),
      ).toThrow('Unexpected hook type.');
    });
  });

  describe('useRef()', () => {
    it('returns a memoized ref object', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      const ref = session.useRef('foo');

      expect(ref).toStrictEqual({ current: 'foo' });

      session.finalize();
      session.flush();

      expect(session.useRef('bar')).toBe(ref);

      session.finalize();
      session.flush();
    });
  });

  describe('useState()', () => {
    it('schedules the update when the state is changed', async () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      let [count, setCount] = session.useState(0);

      session.finalize();
      session.flush();

      expect(count).toBe(0);

      expect(await session.waitforUpdate()).toBe(0);

      setCount(1);

      expect(await session.waitforUpdate()).toBe(1);

      [count, setCount] = session.useState(0);

      session.finalize();
      session.flush();

      expect(count).toBe(1);
    });

    it('should skip the update if the state does not changed', async () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      let [count, setCount] = session.useState(0);

      session.finalize();
      session.flush();

      expect(count).toBe(0);

      expect(await session.waitforUpdate()).toBe(0);

      setCount(0);

      expect(await session.waitforUpdate()).toBe(0);

      [count, setCount] = session.useState(0);

      expect(count).toBe(0);

      session.finalize();
      session.flush();
    });

    it('can set the state by the function', async () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      let [count, setCount] = session.useState(() => 0);

      session.finalize();
      session.flush();

      expect(count).toBe(0);

      // Call twice and the result is the same.
      setCount((count) => count + 1);
      setCount((count) => count + 1);

      expect(await session.waitforUpdate()).toBe(1);

      [count, setCount] = session.useState(0);

      expect(count).toBe(1);

      session.finalize();
      session.flush();
    });

    it('should not return the pending state', async () => {
      const session = new RenderSession(
        [],
        Lane.UserBlocking,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      let [count, setCount, isPending] = session.useState(() => 0);

      expect(session.finalize()).toBe(NO_LANES);
      session.flush();

      expect(count).toBe(0);
      expect(isPending).toBe(false);

      setCount(1, { priority: 'background' });

      expect(await session.waitforUpdate()).toBe(1);

      [count, setCount, isPending] = session.useState(0);

      expect(count).toBe(0);
      expect(isPending).toBe(true);

      expect(session.finalize()).toBe(Lane.Background);
      session.flush();
    });
  });

  describe('useSyncExternalStore()', () => {
    it('forces the update if the snapshot is changed when the store is updated', async () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
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

      expect(session.useSyncEnternalStore(subscribe, getSnapshot)).toBe(0);

      session.finalize();
      session.flush();

      notifySubscribers();

      expect(await session.waitforUpdate()).toBe(1);
      expect(subscribers.size).toBe(1);

      expect(session.useSyncEnternalStore(subscribe, getSnapshot)).toBe(1);

      session.finalize();
      session.flush();

      expect(await session.waitforUpdate()).toBe(0);

      cleanupHooks(session['_hooks']);

      expect(subscribers.size).toBe(0);
    });

    it('forces the update if the snapshot have been changed during update', async () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );
      let count = 0;

      const unsubscribe = vi.fn();
      const subscribe = vi.fn().mockReturnValue(unsubscribe);
      const getSnapshot = () => count;

      expect(session.useSyncEnternalStore(subscribe, getSnapshot)).toBe(0);

      session['_context'].enqueueMutationEffect({
        commit() {
          count++;
        },
      });

      session.finalize();
      session.flush();

      expect(await session.waitforUpdate()).toBe(1);
      expect(subscribe).toHaveBeenCalledOnce();
      expect(unsubscribe).not.toHaveBeenCalled();

      expect(session.useSyncEnternalStore(subscribe, getSnapshot)).toBe(1);

      session['_context'].enqueueLayoutEffect({
        commit() {
          count++;
        },
      });

      session.finalize();
      session.flush();

      expect(await session.waitforUpdate()).toBe(0);
      expect(subscribe).toHaveBeenCalledOnce();
      expect(unsubscribe).not.toHaveBeenCalled();

      cleanupHooks(session['_hooks']);

      expect(subscribe).toHaveBeenCalledOnce();
      expect(unsubscribe).toHaveBeenCalledOnce();
    });

    it('should resubscribe the store if the subscribe function is changed', async () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockBackend()),
      );

      const unsubscribe1 = vi.fn();
      const unsubscribe2 = vi.fn();
      const subscribe1 = vi.fn().mockReturnValue(unsubscribe1);
      const subscribe2 = vi.fn().mockReturnValue(unsubscribe2);
      const getSnapshot1 = () => 'foo';
      const getSnapshot2 = () => 'bar';

      expect(session.useSyncEnternalStore(subscribe1, getSnapshot1)).toBe(
        'foo',
      );

      session.finalize();
      session.flush();

      expect(await session.waitforUpdate()).toBe(0);

      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(0);
      expect(unsubscribe1).toHaveBeenCalledTimes(0);
      expect(unsubscribe2).toHaveBeenCalledTimes(0);

      expect(session.useSyncEnternalStore(subscribe2, getSnapshot1)).toBe(
        'foo',
      );

      session.finalize();
      session.flush();

      expect(await session.waitforUpdate()).toBe(0);

      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(1);
      expect(unsubscribe1).toHaveBeenCalledTimes(1);
      expect(unsubscribe2).toHaveBeenCalledTimes(0);

      expect(session.useSyncEnternalStore(subscribe2, getSnapshot2)).toBe(
        'bar',
      );

      session.finalize();
      session.flush();

      expect(await session.waitforUpdate()).toBe(0);

      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(1);
      expect(unsubscribe1).toHaveBeenCalledTimes(1);
      expect(unsubscribe2).toHaveBeenCalledTimes(0);

      cleanupHooks(session['_hooks']);

      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(1);
      expect(unsubscribe1).toHaveBeenCalledTimes(1);
      expect(unsubscribe2).toHaveBeenCalledTimes(1);
    });
  });
});
