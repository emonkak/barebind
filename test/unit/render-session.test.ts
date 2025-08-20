import { describe, expect, it, vi } from 'vitest';
import {
  $customHook,
  type CustomHookFunction,
  Lanes,
  Literal,
  type RefObject,
} from '@/internal.js';
import { MockCoroutine, MockTemplate } from '../mocks.js';
import { createRenderSession, flushRenderSession } from '../session-utils.js';

describe('RenderSession', () => {
  describe('dynamicHTML()', () => {
    it('returns a bindable with the dynamic HTML template', () => {
      const session = createRenderSession();
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
      const session = createRenderSession();
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
      const session = createRenderSession();
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
    it.for(['foo', Symbol('bar'), {}])(
      'returns a session value by the key',
      (key) => {
        const session = createRenderSession();

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
      const session = createRenderSession();

      session.finalize();

      expect(() => session.useState(0)).toThrow();
    });

    it('throws an error if given a different type of hook', () => {
      const session = createRenderSession();

      session.useEffect(() => {});

      flushRenderSession(session);

      expect(() => session.finalize()).toThrow('Unexpected hook type.');
    });
  });

  describe('forceUpdate()', () => {
    it('schedules the update with the current coroutine', async () => {
      const session = createRenderSession();
      const options = { priority: 'background' } as const;

      const scheduleUpdateSpy = vi
        .spyOn(session['_context'], 'scheduleUpdate')
        .mockImplementation(() => ({
          coroutine: new MockCoroutine(),
          lanes: Lanes.BackgroundLane,
          running: false,
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
      const session = createRenderSession();
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
      const session = createRenderSession();
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
      const session = createRenderSession();
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
      const session = createRenderSession();
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
    it('performs a custom hook function', () => {
      const session = createRenderSession();
      const result = 'foo';
      const hook = vi.fn().mockReturnValue(result);

      expect(session.use(hook)).toBe(result);
      expect(hook).toHaveBeenCalledOnce();
      expect(hook).toHaveBeenCalledWith(session);
    });

    it('performs a custom hook object', () => {
      const session = createRenderSession();
      const result = 'foo';
      const hook = new (class {
        [$customHook]: CustomHookFunction<void>;

        constructor(curstomHook: CustomHookFunction<void>) {
          this[$customHook] = curstomHook;
        }
      })(vi.fn().mockReturnValue(result));

      expect(session.use(hook)).toBe(result);
      expect(hook[$customHook]).toHaveBeenCalledOnce();
      expect(hook[$customHook]).toHaveBeenCalledWith(session);
    });
  });

  describe('useCallback()', () => {
    it('returns the memoized callback if dependencies are the same as the previous value', () => {
      const session = createRenderSession();
      const callback1 = () => {};
      const callback2 = () => {};

      SESSION1: {
        expect(session.useCallback(callback1, ['foo'])).toBe(callback1);

        flushRenderSession(session);
      }

      SESSION2: {
        expect(session.useCallback(callback2, ['foo'])).toBe(callback1);

        flushRenderSession(session);
      }

      SESSION3: {
        expect(session.useCallback(callback2, ['bar'])).toBe(callback2);

        flushRenderSession(session);
      }
    });
  });

  describe.each([
    ['useEffect', 'enqueuePassiveEffect'],
    ['useLayoutEffect', 'enqueueLayoutEffect'],
    ['useInsertionEffect', 'enqueueMutationEffect'],
  ] as const)('useEffect()', (hookMethod, key) => {
    it('performs the cleanup function when the callback is changed', () => {
      const session = createRenderSession();

      const cleanup = vi.fn();
      const callback = vi.fn().mockReturnValue(cleanup);
      const enqueueEffectSpy = vi.spyOn(session['_context'], key);

      SESSION1: {
        session[hookMethod](callback);

        flushRenderSession(session);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(cleanup).toHaveBeenCalledTimes(0);
        expect(enqueueEffectSpy).toHaveBeenCalledTimes(1);
      }

      SESSION2: {
        session[hookMethod](callback);

        flushRenderSession(session);

        expect(callback).toHaveBeenCalledTimes(2);
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(enqueueEffectSpy).toHaveBeenCalledTimes(2);
      }
    });

    it('does not perform the callback function if dependencies are not changed', () => {
      const session = createRenderSession();

      const callback = vi.fn();
      const enqueueEffectSpy = vi.spyOn(session['_context'], key);

      SESSION1: {
        session[hookMethod](callback, ['foo']);

        flushRenderSession(session);

        expect(enqueueEffectSpy).toHaveBeenCalledTimes(1);
      }

      SESSION2: {
        session[hookMethod](callback, ['foo']);

        flushRenderSession(session);

        expect(callback).toHaveBeenCalledTimes(1);
      }

      SESSION3: {
        session[hookMethod](callback, ['bar']);

        flushRenderSession(session);

        expect(callback).toHaveBeenCalledTimes(2);
      }
    });

    it('throws an error if given a different type of hook', () => {
      const session = createRenderSession();

      flushRenderSession(session);

      expect(() => session[hookMethod](() => {})).toThrow(
        'Unexpected hook type.',
      );
    });
  });

  describe('useId()', () => {
    it('returns a unique identifier', () => {
      const session = createRenderSession();

      let id1: string;
      let id2: string;

      SESSION1: {
        id1 = session.useId();
        id2 = session.useId();

        expect(id1).toMatch(/[0-9a-z]+:1/);
        expect(id2).toMatch(/[0-9a-z]+:2/);

        flushRenderSession(session);
      }

      SESSION2: {
        expect(session.useId()).toBe(id1);
        expect(session.useId()).toBe(id2);

        flushRenderSession(session);
      }
    });

    it('throws an error if given a different type of hook', () => {
      const session = createRenderSession();

      flushRenderSession(session);

      expect(() => session.useId()).toThrow('Unexpected hook type.');
    });
  });

  describe('useMemo()', () => {
    it('returns the memoized value if dependencies are the same as the previous value', () => {
      const session = createRenderSession();
      const value1 = 'foo';
      const value2 = 'bar';

      SESSION1: {
        expect(session.useMemo(() => value1, ['foo'])).toBe(value1);

        flushRenderSession(session);
      }

      SESSION2: {
        expect(session.useMemo(() => value2, ['foo'])).toBe(value1);

        flushRenderSession(session);
      }

      SESSION3: {
        expect(session.useMemo(() => value2, ['bar'])).toBe(value2);

        flushRenderSession(session);
      }
    });

    it('throws an error if given a different type of hook', () => {
      const session = createRenderSession();

      flushRenderSession(session);

      expect(() => session.useMemo(() => null, [])).toThrow(
        'Unexpected hook type.',
      );
    });
  });

  describe('useReducer()', () => {
    it('schedules the update when the state is changed', async () => {
      const session = createRenderSession();
      const reducer = (count: number, n: number) => count + n;

      SESSION1: {
        const [count, increment] = session.useReducer(reducer, 0);

        session.useEffect(() => {
          increment(1);
        }, []);

        flushRenderSession(session);

        expect(count).toBe(0);
      }

      expect(session.isUpdatePending()).toBe(true);
      expect(await session.waitForUpdate()).toBe(1);

      SESSION2: {
        const [count, increment] = session.useReducer(reducer, 0);

        session.useEffect(() => {
          increment(1);
        }, []);

        flushRenderSession(session);

        expect(count).toBe(1);
      }

      expect(session.isUpdatePending()).toBe(false);
      expect(await session.waitForUpdate()).toBe(0);
    });

    it('should skip the update if the state does not changed', async () => {
      const session = createRenderSession();
      const reducer = (count: number, n: number) => count + n;

      SESSION1: {
        const [count, increment] = session.useReducer(reducer, 0);

        session.useEffect(() => {
          increment(0);
        }, []);

        flushRenderSession(session);

        expect(count).toBe(0);
      }

      expect(session.isUpdatePending()).toBe(false);
      expect(await session.waitForUpdate()).toBe(0);
    });

    it('returns the initial state by the function', async () => {
      const session = createRenderSession();
      const reducer = (count: number, n: number) => count + n;

      const [count] = session.useReducer(reducer, () => 0);

      flushRenderSession(session);

      expect(count).toBe(0);
    });

    it('throws an error if given a different type of hook', () => {
      const session = createRenderSession();

      flushRenderSession(session);

      expect(() =>
        session.useReducer<number, number>((count, n) => count + n, 0),
      ).toThrow('Unexpected hook type.');
    });
  });

  describe('useRef()', () => {
    it('returns a memoized ref object', () => {
      const session = createRenderSession();

      let ref: RefObject<string>;

      SESSION1: {
        ref = session.useRef('foo');

        expect(ref).toStrictEqual({ current: 'foo' });

        flushRenderSession(session);
      }

      SESSION2: {
        expect(session.useRef('bar')).toBe(ref);

        flushRenderSession(session);
      }
    });
  });

  describe('useState()', () => {
    it('schedules the update when the state is changed', async () => {
      const session = createRenderSession();

      SESSION1: {
        const [count, setCount] = session.useState(0);

        session.useEffect(() => {
          setCount(1);
        }, []);

        flushRenderSession(session);

        expect(count).toBe(0);
      }

      expect(session.isUpdatePending()).toBe(true);
      expect(await session.waitForUpdate()).toBe(1);

      SESSION2: {
        const [count, setCount] = session.useState(0);

        session.useEffect(() => {
          setCount(1);
        }, []);

        flushRenderSession(session);

        expect(count).toBe(1);
      }

      expect(session.isUpdatePending()).toBe(false);
      expect(await session.waitForUpdate()).toBe(0);
    });

    it('should skip the update if the state does not changed', async () => {
      const session = createRenderSession();

      SESSION1: {
        const [count, setCount] = session.useState(0);

        session.useEffect(() => {
          setCount(0);
        }, []);

        flushRenderSession(session);

        expect(count).toBe(0);
      }

      expect(session.isUpdatePending()).toBe(false);
      expect(await session.waitForUpdate()).toBe(0);
    });

    it('sets a new state from the old one', async () => {
      const session = createRenderSession();

      SESSION1: {
        const [count, setCount] = session.useState(() => 0);

        session.useEffect(() => {
          // Call twice and the result is the same.
          setCount((count) => count + 1);
          setCount((count) => count + 1);
        }, []);

        flushRenderSession(session);

        expect(count).toBe(0);
      }

      expect(session.isUpdatePending()).toBe(true);
      expect(await session.waitForUpdate()).toBe(1);

      SESSION2: {
        const [count, setCount] = session.useState(0);

        session.useEffect(() => {
          setCount((count) => count + 1);
          setCount((count) => count + 1);
        }, []);

        flushRenderSession(session);

        expect(count).toBe(1);
      }

      expect(session.isUpdatePending()).toBe(false);
      expect(await session.waitForUpdate()).toBe(0);
    });

    it('should not return the pending state', async () => {
      const session = createRenderSession(Lanes.UserBlockingLane);

      SESSION1: {
        const [count, setCount, isPending] = session.useState(() => 0);

        session.useEffect(() => {
          setCount(1, { priority: 'background' });
        }, []);

        expect(count).toBe(0);
        expect(isPending).toBe(false);

        flushRenderSession(session);
      }

      expect(session.isUpdatePending()).toBe(true);
      expect(await session.waitForUpdate()).toBe(1);

      SESSION2: {
        const [count, setCount, isPending] = session.useState(0);

        session.useEffect(() => {
          setCount(1, { priority: 'background' });
        }, []);

        expect(count).toBe(0);
        expect(isPending).toBe(true);

        flushRenderSession(session);
      }

      expect(session.isUpdatePending()).toBe(false);
      expect(await session.waitForUpdate()).toBe(0);
    });
  });
});
