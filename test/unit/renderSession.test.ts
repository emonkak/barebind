import { describe, expect, it, vi } from 'vitest';
import { $customHook, ALL_LANES, CommitPhase, Lane } from '@/hook.js';
import { RenderSession } from '@/renderSession.js';
import { Runtime } from '@/runtime.js';
import { Literal } from '@/templateLiteral.js';
import { MockCoroutine, MockRenderHost, MockTemplate } from '../mocks.js';
import { cleanupHooks } from '../testUtils.js';

describe('RenderSession', () => {
  describe('dynamicHTML()', () => {
    it('returns a bindable with the dynamic HTML template', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockRenderHost()),
      );
      const element = session.dynamicHTML`<${new Literal('div')}>Hello, ${'World'}!</${new Literal('div')}>`;

      expect(element.directive).toBeInstanceOf(MockTemplate);
      expect(element.directive).toStrictEqual(
        expect.objectContaining({
          strings: ['<div>Hello, ', '!</div>'],
          binds: ['World'],
          mode: 'html',
        }),
      );
      expect(element.value).toStrictEqual(['World']);
    });
  });

  describe('dynamicMath()', () => {
    it('returns a bindable with the dynamic MathML template', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockRenderHost()),
      );
      const element = session.dynamicMath`<${new Literal('mi')}>${'x'}</${new Literal('mi')}>`;

      expect(element.directive).toBeInstanceOf(MockTemplate);
      expect(element.directive).toStrictEqual(
        expect.objectContaining({
          strings: ['<mi>', '</mi>'],
          binds: ['x'],
          mode: 'math',
        }),
      );
      expect(element.value).toStrictEqual(['x']);
    });
  });

  describe('dynamicSVG()', () => {
    it('returns a bindable with the dynamic SVG template', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockRenderHost()),
      );
      const element = session.dynamicSVG`<${new Literal('text')}>Hello, ${'World'}!</${new Literal('text')}>`;

      expect(element.directive).toBeInstanceOf(MockTemplate);
      expect(element.directive).toStrictEqual(
        expect.objectContaining({
          strings: ['<text>Hello, ', '!</text>'],
          binds: ['World'],
          mode: 'svg',
        }),
      );
      expect(element.value).toStrictEqual(['World']);
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
          new Runtime(new MockRenderHost()),
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
        new Runtime(new MockRenderHost()),
      );

      session.finalize();

      expect(() => session.useState(0)).toThrow();
    });
  });

  describe('forceUpdate()', () => {
    it('schedules the update with the current coroutine', async () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockRenderHost()),
      );
      const options = { priority: 'background' } as const;

      const scheduleUpdateSpy = vi
        .spyOn(session['_context'], 'scheduleUpdate')
        .mockImplementation(() => ({
          priority: options.priority,
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
        new Runtime(new MockRenderHost()),
      );
      const element = session.html`<div>Hello, ${'World'}!</div>`;

      expect(element.directive).toBeInstanceOf(MockTemplate);
      expect(element.directive).toStrictEqual(
        expect.objectContaining({
          strings: ['<div>Hello, ', '!</div>'],
          binds: ['World'],
          mode: 'html',
        }),
      );
      expect(element.value).toStrictEqual(['World']);
    });
  });

  describe('math()', () => {
    it('returns a bindable with the MathML template', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockRenderHost()),
      );
      const element = session.math`<mi>${'x'}</mi>`;

      expect(element.directive).toBeInstanceOf(MockTemplate);
      expect(element.directive).toStrictEqual(
        expect.objectContaining({
          strings: ['<mi>', '</mi>'],
          binds: ['x'],
          mode: 'math',
        }),
      );
      expect(element.value).toStrictEqual(['x']);
    });
  });

  describe('svg()', () => {
    it('returns a bindable with dynamic the SVG template', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockRenderHost()),
      );
      const element = session.svg`<text>Hello, ${'World'}!</text>`;

      expect(element.directive).toBeInstanceOf(MockTemplate);
      expect(element.directive).toStrictEqual(
        expect.objectContaining({
          strings: ['<text>Hello, ', '!</text>'],
          binds: ['World'],
          mode: 'svg',
        }),
      );
      expect(element.value).toStrictEqual(['World']);
    });
  });

  describe('use()', () => {
    it('performs the custom hook', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockRenderHost()),
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
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockRenderHost()),
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
        new Runtime(new MockRenderHost()),
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

      expect(await session.waitforUpdate()).toBe(true);

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
        new Runtime(new MockRenderHost()),
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
    ['useEffect', CommitPhase.Passive],
    ['useLayoutEffect', CommitPhase.Layout],
    ['useInsertionEffect', CommitPhase.Mutation],
  ] as const)('useEffect()', (method, phase) => {
    it('performs the cleanup function when the callback is changed', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockRenderHost()),
      );

      const cleanup = vi.fn();
      const callback = vi.fn().mockReturnValue(cleanup);
      const enqueueEffectSpy = vi.spyOn(session['_context'], 'enqueueEffect');

      session[method](callback);

      session.finalize();
      session.flush();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(cleanup).toHaveBeenCalledTimes(0);

      session[method](callback);

      session.finalize();
      session.flush();

      expect(callback).toHaveBeenCalledTimes(2);
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(enqueueEffectSpy).toHaveBeenCalledTimes(2);
      expect(enqueueEffectSpy).toHaveBeenCalledWith(expect.anything(), phase);
    });

    it('does not perform the callback function if dependencies are not changed', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockRenderHost()),
      );

      const callback = vi.fn();
      const enqueueEffectSpy = vi.spyOn(session['_context'], 'enqueueEffect');

      session[method](callback, []);

      session.finalize();
      session.flush();

      expect(callback).toHaveBeenCalledOnce();

      session[method](callback, []);

      session.finalize();
      session.flush();

      expect(callback).toHaveBeenCalledOnce();
      expect(enqueueEffectSpy).toHaveBeenCalledTimes(1);
      expect(enqueueEffectSpy).toHaveBeenCalledWith(expect.anything(), phase);
    });
  });

  describe('useId()', () => {
    it('returns a unique identifier', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockRenderHost()),
      );
      let identifierCount = 0;

      const nextIdentifierSpy = vi
        .spyOn(session['_context'], 'nextIdentifier')
        .mockImplementation(() => {
          return 'test-' + ++identifierCount;
        });

      expect(session.useId()).toBe('test-1');
      expect(session.useId()).toBe('test-2');

      session.finalize();
      session.flush();

      expect(session.useId()).toBe('test-1');
      expect(session.useId()).toBe('test-2');
      expect(nextIdentifierSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('useMemo()', () => {
    it('returns the memoized value if dependencies are the same as the previous value', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockRenderHost()),
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
  });

  describe('useReducer()', () => {
    it('schedules the update when the state is changed', async () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockRenderHost()),
      );
      const reducer = (count: number, n: number) => count + n;

      let [count, increment] = session.useReducer(reducer, 0);

      session.finalize();
      session.flush();

      expect(count).toBe(0);

      expect(await session.waitforUpdate()).toBe(false);

      increment(1);

      expect(await session.waitforUpdate()).toBe(true);

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
        new Runtime(new MockRenderHost()),
      );
      const reducer = (count: number, n: number) => count + n;

      let [count, increment] = session.useReducer(reducer, 0);

      session.finalize();
      session.flush();

      expect(count).toBe(0);

      expect(await session.waitforUpdate()).toBe(false);

      increment(0);

      expect(await session.waitforUpdate()).toBe(false);

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
        new Runtime(new MockRenderHost()),
      );
      const reducer = (count: number, n: number) => count + n;

      const [count] = session.useReducer(reducer, () => 0);

      session.finalize();
      session.flush();

      expect(count).toBe(0);
    });
  });

  describe('useRef()', () => {
    it('returns a memoized ref object', () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockRenderHost()),
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
        new Runtime(new MockRenderHost()),
      );

      let [count, setCount] = session.useState(0);

      session.finalize();
      session.flush();

      expect(count).toBe(0);

      expect(await session.waitforUpdate()).toBe(false);

      setCount(1);

      expect(await session.waitforUpdate()).toBe(true);

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
        new Runtime(new MockRenderHost()),
      );

      let [count, setCount] = session.useState(0);

      session.finalize();
      session.flush();

      expect(count).toBe(0);

      expect(await session.waitforUpdate()).toBe(false);

      setCount(0);

      expect(await session.waitforUpdate()).toBe(false);

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
        new Runtime(new MockRenderHost()),
      );

      let [count, setCount] = session.useState(() => 0);

      session.finalize();
      session.flush();

      expect(count).toBe(0);

      // Call twice and the result is the same.
      setCount((count) => count + 1);
      setCount((count) => count + 1);

      expect(await session.waitforUpdate()).toBe(true);

      [count, setCount] = session.useState(0);

      expect(count).toBe(1);

      session.finalize();
      session.flush();
    });

    it('should not return the pending state', async () => {
      const session = new RenderSession(
        [],
        Lane.UserInput,
        new MockCoroutine(),
        new Runtime(new MockRenderHost()),
      );

      let [count, setCount] = session.useState(() => 0);

      session.finalize();
      session.flush();

      expect(count).toBe(0);

      setCount(1, { priority: 'background' });

      expect(await session.waitforUpdate()).toBe(true);

      [count, setCount] = session.useState(0);

      expect(count).toBe(0);

      session.finalize();
      session.flush();
    });
  });

  describe('useSyncExternalStore()', () => {
    it('forces the update if the snapshot is changed when the store is updated', async () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockRenderHost()),
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

      expect(await session.waitforUpdate()).toBe(true);
      expect(subscribers.size).toBe(1);

      expect(session.useSyncEnternalStore(subscribe, getSnapshot)).toBe(1);

      session.finalize();
      session.flush();

      expect(await session.waitforUpdate()).toBe(false);

      cleanupHooks(session['_hooks']);

      expect(subscribers.size).toBe(0);
    });

    it('forces the update if the snapshot have been changed during update', async () => {
      const session = new RenderSession(
        [],
        ALL_LANES,
        new MockCoroutine(),
        new Runtime(new MockRenderHost()),
      );
      let count = 0;

      const unsubscribe = vi.fn();
      const subscribe = vi.fn().mockReturnValue(unsubscribe);
      const getSnapshot = () => count;

      expect(session.useSyncEnternalStore(subscribe, getSnapshot)).toBe(0);

      session.useInsertionEffect(() => {
        count++;
      }, []);

      session.finalize();
      session.flush();

      expect(await session.waitforUpdate()).toBe(true);
      expect(subscribe).toHaveBeenCalledOnce();
      expect(unsubscribe).not.toHaveBeenCalled();

      expect(session.useSyncEnternalStore(subscribe, getSnapshot)).toBe(1);

      session.useLayoutEffect(() => {
        count++;
      }, []);

      session.finalize();
      session.flush();

      expect(await session.waitforUpdate()).toBe(false);
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
        new Runtime(new MockRenderHost()),
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

      expect(await session.waitforUpdate()).toBe(false);

      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(0);
      expect(unsubscribe1).toHaveBeenCalledTimes(0);
      expect(unsubscribe2).toHaveBeenCalledTimes(0);

      expect(session.useSyncEnternalStore(subscribe2, getSnapshot1)).toBe(
        'foo',
      );

      session.finalize();
      session.flush();

      expect(await session.waitforUpdate()).toBe(false);

      expect(subscribe1).toHaveBeenCalledTimes(1);
      expect(subscribe2).toHaveBeenCalledTimes(1);
      expect(unsubscribe1).toHaveBeenCalledTimes(1);
      expect(unsubscribe2).toHaveBeenCalledTimes(0);

      expect(session.useSyncEnternalStore(subscribe2, getSnapshot2)).toBe(
        'bar',
      );

      session.finalize();
      session.flush();

      expect(await session.waitforUpdate()).toBe(false);

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
