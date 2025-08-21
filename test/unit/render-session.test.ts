import { describe, expect, it, vi } from 'vitest';
import {
  $customHook,
  CommitPhase,
  type RefObject,
  type RenderContext,
} from '@/internal.js';
import { RenderSession } from '@/render-session.js';
import { Literal } from '@/template-literal.js';
import { MockTemplate } from '../mocks.js';
import { RenderHelper } from '../test-helpers.js';

describe('RenderSession', () => {
  describe('dynamicHTML()', () => {
    it('returns a bindable with the dynamic HTML template', () => {
      const helper = new RenderHelper();
      const directive = helper.startSession(
        (context) =>
          context.dynamicHTML`<${new Literal('div')}>Hello, ${'World'}!</${new Literal('div')}>`,
      );

      expect(directive.type).toBeInstanceOf(MockTemplate);
      expect(directive.type).toStrictEqual(
        expect.objectContaining({
          strings: ['<div>Hello, ', '!</div>'],
          binds: ['World'],
          mode: 'html',
        }),
      );
      expect(directive.value).toStrictEqual(['World']);
    });
  });

  describe('dynamicMath()', () => {
    it('returns a bindable with the dynamic MathML template', () => {
      const helper = new RenderHelper();
      const directive = helper.startSession(
        (context) =>
          context.dynamicMath`<${new Literal('mi')}>${'x'}</${new Literal('mi')}>`,
      );

      expect(directive.type).toBeInstanceOf(MockTemplate);
      expect(directive.type).toStrictEqual(
        expect.objectContaining({
          strings: ['<mi>', '</mi>'],
          binds: ['x'],
          mode: 'math',
        }),
      );
      expect(directive.value).toStrictEqual(['x']);
    });
  });

  describe('dynamicSVG()', () => {
    it('returns a bindable with the dynamic SVG template', () => {
      const helper = new RenderHelper();
      const directive = helper.startSession(
        (context) =>
          context.dynamicSVG`<${new Literal('text')}>Hello, ${'World'}!</${new Literal('text')}>`,
      );

      expect(directive.type).toBeInstanceOf(MockTemplate);
      expect(directive.type).toStrictEqual(
        expect.objectContaining({
          strings: ['<text>Hello, ', '!</text>'],
          binds: ['World'],
          mode: 'svg',
        }),
      );
      expect(directive.value).toStrictEqual(['World']);
    });
  });

  describe('getContextValue()', () => {
    it('returns the context value corresponding to the key', () => {
      const helper = new RenderHelper();

      SESSION: {
        const value = helper.startSession((context) => {
          context.setContextValue('foo', 123);

          return context.getContextValue('foo');
        });

        expect(value).toBe(123);
      }
    });

    it('returns undefined if the context value is not definied', () => {
      const helper = new RenderHelper();

      SESSION: {
        const value = helper.startSession((context) => {
          return context.getContextValue('foo');
        });

        expect(value).toBe(undefined);
      }
    });

    it('throws an error when trying to get a context value outside of rendering', () => {
      const helper = new RenderHelper();

      expect(() => {
        const context = helper.startSession((context) => context);
        context.setContextValue('foo', 123);
      }).toThrow('Context values can only be set during rendering.');

      expect(() => {
        const context = helper.startSession((context) => context);
        context.getContextValue('foo');
      }).toThrow('Context values are only avaiable during rendering.');
    });

    it('throws an error when trying to get set a context value outside of rendering', () => {
      const helper = new RenderHelper();

      expect(() => {
        const context = helper.startSession((context) => context);
        context.setContextValue('foo', 123);
      }).toThrow('Context values can only be set during rendering.');

      expect(() => {
        const context = helper.startSession((context) => context);
        context.getContextValue('foo');
      }).toThrow('Context values are only avaiable during rendering.');
    });
  });

  describe('finalize()', () => {
    it('denies using a hook after finalize', () => {
      const helper = new RenderHelper();
      const context = helper.startSession((context) => {
        return context;
      });

      expect(() => context.useState(0)).toThrow();
    });

    it('throws an error if a different type of hook is given', () => {
      const helper = new RenderHelper();

      helper.startSession((context) => {
        context.useEffect(() => {});
      });

      expect(() => {
        helper.startSession((context) => {
          context.finalize();
        });
      }).toThrow('Unexpected hook type.');
    });
  });

  describe('forceUpdate()', () => {
    it('schedules an update with the current coroutine', async () => {
      const helper = new RenderHelper();

      const scheduleUpdateSpy = vi.spyOn(helper.runtime, 'scheduleUpdate');

      helper.startSession((context) => {
        context.useEffect(() => {
          context.forceUpdate({ priority: 'background' });
        }, []);
      });

      expect(scheduleUpdateSpy).toHaveBeenCalledTimes(2);
      expect(scheduleUpdateSpy).toHaveBeenNthCalledWith(2, helper.coroutine, {
        priority: 'background',
      });
    });
  });

  describe('html()', () => {
    it('returns a bindable with the HTML template', () => {
      const helper = new RenderHelper();
      const directive = helper.startSession(
        (context) => context.html`<div>Hello, ${'World'}!</div>`,
      );

      expect(directive.type).toBeInstanceOf(MockTemplate);
      expect(directive.type).toStrictEqual(
        expect.objectContaining({
          strings: ['<div>Hello, ', '!</div>'],
          binds: ['World'],
          mode: 'html',
        }),
      );
      expect(directive.value).toStrictEqual(['World']);
    });
  });

  describe('math()', () => {
    it('returns a bindable with the MathML template', () => {
      const helper = new RenderHelper();
      const directive = helper.startSession(
        (context) => context.math`<mi>${'x'}</mi>`,
      );

      expect(directive.type).toBeInstanceOf(MockTemplate);
      expect(directive.type).toStrictEqual(
        expect.objectContaining({
          strings: ['<mi>', '</mi>'],
          binds: ['x'],
          mode: 'math',
        }),
      );
      expect(directive.value).toStrictEqual(['x']);
    });
  });

  describe('svg()', () => {
    it('returns a bindable with the SVG template', () => {
      const helper = new RenderHelper();
      const directive = helper.startSession(
        (context) => context.svg`<text>Hello, ${'World'}!</text>`,
      );

      expect(directive.type).toBeInstanceOf(MockTemplate);
      expect(directive.type).toStrictEqual(
        expect.objectContaining({
          strings: ['<text>Hello, ', '!</text>'],
          binds: ['World'],
          mode: 'svg',
        }),
      );
      expect(directive.value).toStrictEqual(['World']);
    });
  });

  describe('text()', () => {
    it('returns a bindable with the text template', () => {
      const helper = new RenderHelper();
      const directive = helper.startSession(
        (context) => context.text`<div>Hello, ${'World'}!</div>`,
      );

      expect(directive.type).toBeInstanceOf(MockTemplate);
      expect(directive.type).toStrictEqual(
        expect.objectContaining({
          strings: ['<div>Hello, ', '!</div>'],
          binds: ['World'],
          mode: 'textarea',
        }),
      );
      expect(directive.value).toStrictEqual(['World']);
    });
  });

  describe('use()', () => {
    it('performs a custom hook function', () => {
      const helper = new RenderHelper();
      const hook = vi.fn().mockReturnValue('foo');

      const result = helper.startSession((context) => context.use(hook));

      expect(result).toBe('foo');
      expect(hook).toHaveBeenCalledOnce();
      expect(hook).toHaveBeenCalledWith(expect.any(RenderSession));
    });

    it('performs a custom hook object', () => {
      const helper = new RenderHelper();
      const hook = {
        [$customHook]: vi.fn().mockReturnValue('foo'),
      };

      const result = helper.startSession((context) => context.use(hook));

      expect(result).toBe('foo');
      expect(hook[$customHook]).toHaveBeenCalledOnce();
      expect(hook[$customHook]).toHaveBeenCalledWith(expect.any(RenderSession));
    });
  });

  describe('useCallback()', () => {
    it('returns the memoized callback if dependencies are the same as the previous value', () => {
      const helper = new RenderHelper();
      const callback1 = () => {};
      const callback2 = () => {};

      SESSION1: {
        const callback = helper.startSession((context) => {
          return context.useCallback(callback1, ['foo']);
        });

        expect(callback).toBe(callback1);
      }

      SESSION2: {
        const callback = helper.startSession((context) => {
          return context.useCallback(callback2, ['foo']);
        });

        expect(callback).toBe(callback1);
      }

      SESSION3: {
        const callback = helper.startSession((context) => {
          return context.useCallback(callback2, ['bar']);
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
      const helper = new RenderHelper();

      const cleanup = vi.fn();
      const callback = vi.fn().mockReturnValue(cleanup);
      const commitEffectsSpy = vi.spyOn(
        helper.runtime['_backend'],
        'commitEffects',
      );

      SESSION1: {
        helper.startSession((context) => {
          context[hookName](callback);
        });

        expect(callback).toHaveBeenCalledTimes(1);
        expect(cleanup).toHaveBeenCalledTimes(0);
        expect(commitEffectsSpy).toHaveBeenCalledTimes(1);
        expect(commitEffectsSpy).toHaveBeenCalledWith(
          [expect.any(Object)],
          phase,
        );
      }

      SESSION2: {
        helper.startSession((context) => {
          context[hookName](callback);
        });

        expect(callback).toHaveBeenCalledTimes(2);
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(commitEffectsSpy).toHaveBeenCalledTimes(2);
        expect(commitEffectsSpy).toHaveBeenCalledWith(
          [expect.any(Object)],
          phase,
        );
      }
    });

    it('does not perform the callback function if dependencies are not changed', () => {
      const helper = new RenderHelper();

      const callback = vi.fn();
      const commitEffectsSpy = vi.spyOn(
        helper.runtime['_backend'],
        'commitEffects',
      );

      SESSION1: {
        helper.startSession((context) => {
          context[hookName](callback, ['foo']);
        });

        expect(callback).toHaveBeenCalledTimes(1);
        expect(commitEffectsSpy).toHaveBeenCalledTimes(1);
        expect(commitEffectsSpy).toHaveBeenCalledWith(
          [expect.any(Object)],
          phase,
        );
      }

      SESSION2: {
        helper.startSession((context) => {
          context[hookName](callback, ['foo']);
        });

        expect(callback).toHaveBeenCalledTimes(1);
        expect(commitEffectsSpy).toHaveBeenCalledTimes(1);
      }

      SESSION3: {
        helper.startSession((context) => {
          context[hookName](callback, ['bar']);
        });

        expect(callback).toHaveBeenCalledTimes(2);
        expect(commitEffectsSpy).toHaveBeenCalledTimes(2);
        expect(commitEffectsSpy).toHaveBeenCalledWith(
          [expect.any(Object)],
          phase,
        );
      }
    });

    it('throws an error if given a different type of hook', () => {
      const helper = new RenderHelper();

      helper.startSession(() => {});

      expect(() => {
        helper.startSession((context) => {
          context[hookName](() => {});
        });
      }).toThrow('Unexpected hook type.');
    });
  });

  describe('useId()', () => {
    it('returns a unique identifier', () => {
      const helper = new RenderHelper();

      let stableId1: string;
      let stableId2: string;

      SESSION1: {
        [stableId1, stableId2] = helper.startSession((context) => {
          return [context.useId(), context.useId()];
        });

        expect(stableId1).toMatch(/[0-9a-z]+:1/);
        expect(stableId2).toMatch(/[0-9a-z]+:2/);
      }

      SESSION2: {
        const [id1, id2] = helper.startSession((context) => {
          return [context.useId(), context.useId()];
        });

        expect(id1).toBe(stableId1);
        expect(id2).toBe(stableId2);
      }
    });

    it('throws an error if given a different type of hook', () => {
      const helper = new RenderHelper();

      helper.startSession(() => {});

      expect(() => {
        helper.startSession((context) => {
          context.useId();
        });
      }).toThrow('Unexpected hook type.');
    });
  });

  describe('useMemo()', () => {
    it('returns the memoized value if dependencies are the same as the previous value', () => {
      const helper = new RenderHelper();

      SESSION1: {
        const value = helper.startSession((context) =>
          context.useMemo(() => 'foo', ['foo']),
        );

        expect(value).toBe('foo');
      }

      SESSION2: {
        const value = helper.startSession((context) =>
          context.useMemo(() => 'bar', ['foo']),
        );

        expect(value).toBe('foo');
      }

      SESSION3: {
        const value = helper.startSession((context) =>
          context.useMemo(() => 'bar', ['bar']),
        );

        expect(value).toBe('bar');
      }
    });

    it('throws an error if given a different type of hook', () => {
      const helper = new RenderHelper();

      helper.startSession(() => {});

      expect(() => {
        helper.startSession((context) => {
          context.useMemo(() => null, []);
        });
      }).toThrow('Unexpected hook type.');
    });
  });

  describe('useReducer()', () => {
    it('schedules the update when the state is changed', async () => {
      const helper = new RenderHelper();
      const reducer = (count: number, n: number) => count + n;
      const callback = vi.fn((context: RenderContext) => {
        const [count, increment] = context.useReducer(reducer, 0);

        context.useEffect(() => {
          increment(1);
        }, []);

        return count;
      });

      SESSION: {
        const count = helper.startSession(callback);

        expect(callback).toHaveBeenCalledTimes(2);
        expect(count).toBe(1);
      }
    });

    it('should skip the update if the state does not changed', async () => {
      const helper = new RenderHelper();
      const reducer = (count: number, n: number) => count + n;
      const callback = vi.fn((context: RenderContext) => {
        const [count, increment] = context.useReducer(reducer, 0);

        context.useEffect(() => {
          increment(0);
        }, []);

        return count;
      });

      SESSION: {
        const count = helper.startSession(callback);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(count).toBe(0);
      }
    });

    it('returns an initial state by the function', async () => {
      const helper = new RenderHelper();
      const reducer = (count: number, n: number) => count + n;

      SESSION: {
        const count = helper.startSession((context) => {
          const [count] = context.useReducer(reducer, () => 0);
          return count;
        });

        expect(count).toBe(0);
      }
    });

    it('throws an error if given a different type of hook', () => {
      const helper = new RenderHelper();

      helper.startSession(() => {});

      expect(() => {
        helper.startSession((context) => {
          context.useReducer<number, number>((count, n) => count + n, 0);
        });
      }).toThrow('Unexpected hook type.');
    });
  });

  describe('useRef()', () => {
    it('returns a memoized ref object', () => {
      const helper = new RenderHelper();

      let stableRef: RefObject<string>;

      SESSION1: {
        stableRef = helper.startSession((context) => context.useRef('foo'));

        expect(stableRef).toStrictEqual({ current: 'foo' });
      }

      SESSION2: {
        const ref = helper.startSession((context) => context.useRef('bar'));

        expect(ref).toStrictEqual(stableRef);
      }
    });
  });

  describe('useState()', () => {
    it('schedules the update when the state is changed', async () => {
      const helper = new RenderHelper();
      const callback = vi.fn((context: RenderContext) => {
        const [count, setCount] = context.useState(0);

        context.useEffect(() => {
          setCount(1);
        }, []);

        return count;
      });

      SESSION1: {
        const count = helper.startSession(callback);

        expect(callback).toHaveBeenCalledTimes(2);
        expect(count).toBe(1);
      }

      SESSION1: {
        const count = helper.startSession(callback);

        expect(callback).toHaveBeenCalledTimes(3);
        expect(count).toBe(1);
      }
    });

    it('calculates a new state from the previous state', async () => {
      const helper = new RenderHelper();
      const callback = vi.fn((context: RenderContext) => {
        const [count, setCount] = context.useState(() => 0);

        context.useEffect(() => {
          // Call twice and the result is the same.
          setCount((count) => count + 1);
          setCount((count) => count + 1);
        }, []);

        return count;
      });

      SESSION: {
        const count = helper.startSession(callback);

        expect(count).toBe(1);
        expect(callback).toHaveBeenCalledTimes(2);
      }
    });

    it('should not return the pending state', async () => {
      const helper = new RenderHelper();
      const callback = vi.fn((context: RenderContext) => {
        const [count, setCount, isPending] = context.useState(() => 0);

        context.useEffect(() => {
          queueMicrotask(() => {
            setCount(1, { mode: 'prioritized', priority: 'background' });
          });
        }, []);

        return [count, isPending];
      });

      SESSION1: {
        helper.startSession(callback);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveNthReturnedWith(1, [0, false]);
      }

      await Promise.resolve();

      SESSION2: {
        helper.startSession(callback);

        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback).toHaveNthReturnedWith(2, [0, true]);
      }

      await Promise.resolve();

      SESSION3: {
        helper.startSession(callback, { priority: 'background' });

        expect(callback).toHaveBeenCalledTimes(3);
        expect(callback).toHaveNthReturnedWith(3, [1, false]);
      }
    });
  });
});
