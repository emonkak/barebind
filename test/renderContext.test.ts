import { describe, expect, it, vi } from 'vitest';

import { RenderContext, usableTag } from '../src/renderContext.js';
import { ElementTemplate } from '../src/template/elementTemplate.js';
import { EmptyTemplate } from '../src/template/emptyTemplate.js';
import {
  ChildNodeTemplate,
  TextTemplate,
} from '../src/template/singleTemplate.js';
import { type Hook, HookType } from '../src/types.js';
import { SyncUpdater } from '../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockTemplate,
  MockUpdateHost,
  MockUsableObject,
} from './mocks.js';

describe('RenderContext', () => {
  describe('.childNode()', () => {
    it('should return Fragment with ChildNodeTemplate set as a template', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const context = new RenderContext(hooks, block, host, updater);
      const directive = context.childNode('foo');

      expect(directive.template).toBeInstanceOf(ChildNodeTemplate);
      expect(directive.data).toBe('foo');
    });
  });

  describe('.element()', () => {
    it('should return Fragment with ElementTemplate set as a template', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const context = new RenderContext(hooks, block, host, updater);
      const directive = context.element(
        'div',
        { class: 'foo', id: 'bar' },
        'baz',
      );

      expect(directive.template).toBeInstanceOf(ElementTemplate);
      expect(directive.data).toEqual({
        elementValue: { class: 'foo', id: 'bar' },
        childNodeValue: 'baz',
      });
    });
  });

  describe('.empty()', () => {
    it('should return Fragment with EmptyTemplate set as a template', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new RenderContext(hooks, block, host, updater);
      const directive = context.empty();

      expect(directive.template).toBe(EmptyTemplate.instance);
      expect(directive.data).toEqual(null);
    });
  });

  describe('.finalize()', () => {
    it('should enqueue a Finalizer hook', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      let context = new RenderContext(hooks, block, host, updater);
      context.finalize();
      expect(hooks).toEqual([{ type: HookType.Finalizer }]);

      context = new RenderContext(hooks, block, host, updater);
      context.finalize();
      expect(hooks).toEqual([{ type: HookType.Finalizer }]);
    });

    it('should throw an error if fewer hooks are used than last time.', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const context = new RenderContext(hooks, block, host, updater);
      context.useEffect(() => {});
      context.finalize();

      expect(() => {
        const context = new RenderContext(hooks, block, host, updater);
        context.finalize();
      }).toThrow('Unexpected hook type.');
    });

    it('should throw an error if more hooks are used than last time.', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const context = new RenderContext(hooks, block, host, updater);
      context.finalize();

      expect(() => {
        const context = new RenderContext(hooks, block, host, updater);
        context.useEffect(() => {});
      }).toThrow('Unexpected hook type.');
    });
  });

  describe('.getContextValue()', () => {
    it('should get a value from the block scope', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new RenderContext(hooks, block, host, updater);
      const getScopedValueSpy = vi
        .spyOn(host, 'getScopedValue')
        .mockReturnValue(123);

      expect(context.getContextValue('foo')).toBe(123);
      expect(getScopedValueSpy).toHaveBeenCalledOnce();
      expect(getScopedValueSpy).toHaveBeenCalledWith('foo', block);
    });
  });

  describe('.html()', () => {
    it('should return Fragment with an HTML-formatted TaggedTemplate set as a template', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const context = new RenderContext(hooks, block, host, updater);
      const getHTMLTemplateSpy = vi.spyOn(host, 'getHTMLTemplate');

      const directive = context.html`
        <div class=${0}>Hello, ${1}!</div>
      `;
      expect(directive.value.template).toBeInstanceOf(MockTemplate);
      expect(directive.value.data).toStrictEqual([0, 1]);
      expect(getHTMLTemplateSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.isFirstRender()', () => {
    it('should check whether the render is the first one', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      let context = new RenderContext(hooks, block, host, updater);
      expect(context.isFirstRender()).toBe(true);
      context.finalize();

      context = new RenderContext(hooks, block, host, updater);
      expect(context.isFirstRender()).toBe(false);
      context.finalize();
    });
  });

  describe('.forceUpdate()', () => {
    it('should request update with the given priority', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

      const context = new RenderContext(hooks, block, host, updater);
      context.forceUpdate('background');

      expect(requestUpdateSpy).toHaveBeenCalledOnce();
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'background',
        host,
        updater,
      );
    });

    it('should request update with the host priority', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');
      const getCurrentPrioritySpy = vi
        .spyOn(host, 'getCurrentPriority')
        .mockReturnValue('user-blocking');

      const context = new RenderContext(hooks, block, host, updater);
      context.forceUpdate();

      expect(requestUpdateSpy).toHaveBeenCalledOnce();
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'user-blocking',
        host,
        updater,
      );
      expect(getCurrentPrioritySpy).toHaveBeenCalledOnce();
    });
  });

  describe('.svg()', () => {
    it('should return Fragment with an SVG-hormatted TaggedTemplate set as a template', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const context = new RenderContext(hooks, block, host, updater);
      const getSVGTemplateSpy = vi.spyOn(host, 'getSVGTemplate');

      const directive = context.svg`
        <text x=${0} y=${1}>Hello, ${2}!</text>
      `;
      expect(directive.value.template).toBeInstanceOf(MockTemplate);
      expect(directive.value.data).toStrictEqual([0, 1, 2]);
      expect(getSVGTemplateSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.text()', () => {
    it('should return FragmenFragment TextTemplate set as a template', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const context = new RenderContext(hooks, block, host, updater);
      const directive = context.text('foo');

      expect(directive.template).toBeInstanceOf(TextTemplate);
      expect(directive.data).toEqual('foo');
    });
  });

  describe('.use()', () => {
    it('should handle the UsableCallback', () => {
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const context = new RenderContext(hooks, block, host, updater);
      const callback = vi.fn(() => 'foo');

      expect(context.use(callback)).toBe('foo');
      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith(context);
    });

    it('should handle the UsableObject', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const context = new RenderContext(hooks, block, host, updater);
      const usable = new MockUsableObject('foo');
      const usableSpy = vi.spyOn(usable, usableTag);

      expect(context.use(usable)).toBe('foo');
      expect(usableSpy).toHaveBeenCalledOnce();
      expect(usableSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.useCallback()', () => {
    it('should return a memoized callback', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      let context = new RenderContext(hooks, block, host, updater);
      const callback1 = () => {};
      expect(context.useCallback(callback1, ['foo'])).toBe(callback1);

      context = new RenderContext(hooks, block, host, updater);
      const callback2 = () => {};
      expect(context.useCallback(callback2, ['foo'])).toBe(callback1);

      context = new RenderContext(hooks, block, host, updater);
      const callback3 = () => {};
      expect(context.useCallback(callback3, ['bar'])).toBe(callback3);
    });
  });

  describe('.useDeferredValue()', () => {
    it('should return a value deferred until next rendering', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

      let context = new RenderContext(hooks, block, host, updater);
      expect(context.useDeferredValue('foo')).toBe('foo');

      updater.flushUpdate(host);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(0);

      context = new RenderContext(hooks, block, host, updater);
      expect(context.useDeferredValue('bar')).toBe('foo');

      updater.flushUpdate(host);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'background',
        host,
        updater,
      );

      context = new RenderContext(hooks, block, host, updater);
      expect(context.useDeferredValue('bar')).toBe('bar');

      updater.flushUpdate(host);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
    });

    it('should return a initial value if it is presented', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      let context = new RenderContext(hooks, block, host, updater);
      expect(context.useDeferredValue('bar', 'foo')).toBe('foo');

      updater.flushUpdate(host);

      context = new RenderContext(hooks, block, host, updater);
      expect(context.useDeferredValue('baz')).toBe('bar');

      updater.flushUpdate(host);

      context = new RenderContext(hooks, block, host, updater);
      expect(context.useDeferredValue('baz')).toBe('baz');
    });
  });

  describe('.useEffect()', () => {
    it('should enqueue a callback as a passive effect', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const enqueuePassiveEffectSpy = vi.spyOn(updater, 'enqueuePassiveEffect');

      const effect = vi.fn();

      let context = new RenderContext(hooks, block, host, updater);
      context.useEffect(effect);
      updater.flushUpdate(host);

      expect(effect).toHaveBeenCalledTimes(1);
      expect(enqueuePassiveEffectSpy).toHaveBeenCalledTimes(1);

      context = new RenderContext(hooks, block, host, updater);
      context.useEffect(effect);
      updater.flushUpdate(host);

      expect(effect).toHaveBeenCalledTimes(2);
      expect(enqueuePassiveEffectSpy).toHaveBeenCalledTimes(2);
    });

    it('should perform a cleanup function when a new effect is enqueued', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const cleanup = vi.fn();
      const effect = vi.fn().mockReturnValue(cleanup);

      let context = new RenderContext(hooks, block, host, updater);
      context.useEffect(effect);
      updater.flushUpdate(host);

      expect(cleanup).not.toHaveBeenCalled();
      expect(effect).toHaveBeenCalledTimes(1);

      context = new RenderContext(hooks, block, host, updater);
      context.useEffect(effect);
      updater.flushUpdate(host);

      expect(cleanup).toHaveBeenCalledOnce();
      expect(effect).toHaveBeenCalledTimes(2);
    });

    it('should not perform an effect function if dependencies are not changed', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const effect = vi.fn();

      let context = new RenderContext(hooks, block, host, updater);
      context.useEffect(effect, []);
      updater.flushUpdate(host);

      expect(effect).toHaveBeenCalledOnce();

      context = new RenderContext(hooks, block, host, updater);
      context.useEffect(effect, []);
      updater.flushUpdate(host);

      expect(effect).toHaveBeenCalledOnce();
    });
  });

  describe('.useEvent()', () => {
    it('should always return a stable function', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      let context = new RenderContext(hooks, block, host, updater);
      const stableHandler1 = context.useEvent(handler1);
      updater.flushUpdate(host);
      stableHandler1();

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).not.toHaveBeenCalled();

      context = new RenderContext(hooks, block, host, updater);
      const stableHandler2 = context.useEvent(handler2);
      updater.flushUpdate(host);
      stableHandler1();

      expect(stableHandler2).toBe(stableHandler1);
      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });
  });

  describe('.useLayoutEffect()', () => {
    it('should enqueue a callback as a layout effect', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const enqueueLayoutEffectSpy = vi.spyOn(updater, 'enqueueLayoutEffect');

      const effect = vi.fn();

      let context = new RenderContext(hooks, block, host, updater);
      context.useLayoutEffect(effect);
      updater.flushUpdate(host);

      expect(effect).toHaveBeenCalledTimes(1);
      expect(enqueueLayoutEffectSpy).toHaveBeenCalledTimes(1);

      context = new RenderContext(hooks, block, host, updater);
      context.useLayoutEffect(effect);
      updater.flushUpdate(host);

      expect(effect).toHaveBeenCalledTimes(2);
      expect(enqueueLayoutEffectSpy).toHaveBeenCalledTimes(2);
    });

    it('should perform a cleanup function when a new effect is enqueued', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const cleanup = vi.fn();
      const effect = vi.fn().mockReturnValue(cleanup);

      let context = new RenderContext(hooks, block, host, updater);
      context.useLayoutEffect(effect);
      updater.flushUpdate(host);

      expect(cleanup).not.toHaveBeenCalled();
      expect(effect).toHaveBeenCalledTimes(1);

      context = new RenderContext(hooks, block, host, updater);
      context.useLayoutEffect(effect);
      updater.flushUpdate(host);

      expect(cleanup).toHaveBeenCalledOnce();
      expect(effect).toHaveBeenCalledTimes(2);
    });

    it('should not perform an effect function if dependencies are not changed', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const effect = vi.fn();

      let context = new RenderContext(hooks, block, host, updater);
      context.useLayoutEffect(effect, []);
      updater.flushUpdate(host);

      expect(effect).toHaveBeenCalledOnce();

      context = new RenderContext(hooks, block, host, updater);
      context.useLayoutEffect(effect, []);
      updater.flushUpdate(host);

      expect(effect).toHaveBeenCalledOnce();
    });
  });

  describe('.useMemo()', () => {
    it('should return a memoized value until dependencies is changed', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const factory1 = vi.fn().mockReturnValue('foo');
      const factory2 = vi.fn().mockReturnValue('bar');

      let context = new RenderContext(hooks, block, host, updater);
      expect(context.useMemo(factory1, ['foo'])).toBe('foo');

      context = new RenderContext(hooks, block, host, updater);
      expect(context.useMemo(factory2, ['foo'])).toBe('foo');

      context = new RenderContext(hooks, block, host, updater);
      expect(context.useMemo(factory2, ['bar'])).toBe('bar');
    });
  });

  describe('.useReducer()', () => {
    it('should request update with "inherit" priority', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');
      const getCurrentPrioritySpy = vi
        .spyOn(host, 'getCurrentPriority')
        .mockReturnValue('user-blocking');

      let context = new RenderContext(hooks, block, host, updater);
      let [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        [],
      );
      addMessage('foo');

      expect(message).toEqual([]);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'user-blocking',
        host,
        updater,
      );
      expect(getCurrentPrioritySpy).toHaveBeenCalledTimes(1);

      context = new RenderContext(hooks, block, host, updater);
      [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        [],
      );
      addMessage('bar');

      expect(message).toEqual(['foo']);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(2);
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'user-blocking',
        host,
        updater,
      );
      expect(getCurrentPrioritySpy).toHaveBeenCalledTimes(2);

      context = new RenderContext(hooks, block, host, updater);
      [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        [],
      );

      expect(message).toEqual(['foo', 'bar']);
    });

    it('should request update with user-specified priority', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

      let context = new RenderContext(hooks, block, host, updater);
      let [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        [],
      );
      addMessage('foo', 'user-blocking');

      expect(message).toEqual([]);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'user-blocking',
        host,
        updater,
      );

      context = new RenderContext(hooks, block, host, updater);
      [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        [],
      );
      addMessage('bar', 'background');

      expect(message).toEqual(['foo']);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(2);
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'background',
        host,
        updater,
      );

      context = new RenderContext(hooks, block, host, updater);
      [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        [],
      );

      expect(message).toEqual(['foo', 'bar']);
    });

    it('should skip request update if the state has not changed', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

      let context = new RenderContext(hooks, block, host, updater);
      let [count, addCount] = context.useReducer<number, number>(
        (count, n) => count + n,
        0,
      );
      addCount(0);

      expect(count).toEqual(0);
      expect(requestUpdateSpy).not.toHaveBeenCalled();

      context = new RenderContext(hooks, block, host, updater);
      [count] = context.useReducer<number, number>((count, n) => count + n, 0);
      addCount(0);

      expect(count).toEqual(0);
      expect(requestUpdateSpy).not.toHaveBeenCalled();
    });

    it('should return the function result as an initial state', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      let context = new RenderContext(hooks, block, host, updater);
      let [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        () => ['foo', 'bar'],
      );
      expect(message).toEqual(['foo', 'bar']);

      addMessage('baz');

      context = new RenderContext(hooks, block, host, updater);
      [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        () => ['foo', 'bar'],
      );
      expect(message).toEqual(['foo', 'bar', 'baz']);
    });

    it('should always return the same dispatcher', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      let context = new RenderContext(hooks, block, host, updater);
      const [message1, addMessage1] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        () => ['foo', 'bar'],
      );

      context = new RenderContext(hooks, block, host, updater);
      const [message2, addMessage2] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        () => ['foo', 'bar'],
      );
      expect(message1).toBe(message2);
      expect(addMessage1).toBe(addMessage2);
    });
  });

  describe('.useRef()', () => {
    it('should return a same object', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      let context = new RenderContext(hooks, block, host, updater);
      const ref = context.useRef('foo');
      expect(ref).toEqual({ current: 'foo' });

      context = new RenderContext(hooks, block, host, updater);
      expect(context.useRef('foo')).toBe(ref);
    });
  });

  describe('.useState()', () => {
    it('should request update with the host priority', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');
      const getCurrentPrioritySpy = vi
        .spyOn(host, 'getCurrentPriority')
        .mockReturnValue('user-blocking');

      let context = new RenderContext(hooks, block, host, updater);
      let [count, setCount] = context.useState(0);
      setCount(1);

      expect(count).toEqual(0);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'user-blocking',
        host,
        updater,
      );
      expect(getCurrentPrioritySpy).toHaveBeenCalledTimes(1);

      context = new RenderContext(hooks, block, host, updater);
      [count, setCount] = context.useState(0);
      setCount((n) => n + 2);

      expect(count).toEqual(1);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(2);
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'user-blocking',
        host,
        updater,
      );
      expect(getCurrentPrioritySpy).toHaveBeenCalledTimes(2);

      context = new RenderContext(hooks, block, host, updater);
      [count, setCount] = context.useState(0);

      expect(count).toEqual(3);
    });

    it('should request update with user-specified priority', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

      let context = new RenderContext(hooks, block, host, updater);
      let [count, setCount] = context.useState(0);
      setCount(1, 'user-blocking');

      expect(count).toEqual(0);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'user-blocking',
        host,
        updater,
      );

      context = new RenderContext(hooks, block, host, updater);
      [count, setCount] = context.useState(0);
      setCount((n) => n + 2, 'background');

      expect(count).toEqual(1);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(2);
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'background',
        host,
        updater,
      );

      context = new RenderContext(hooks, block, host, updater);
      [count, setCount] = context.useState(0);

      expect(count).toEqual(3);
    });

    it('should skip requst update if the state has not changed', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

      let context = new RenderContext(hooks, block, host, updater);
      let [count, setCount] = context.useState(0);
      setCount(0);

      expect(count).toEqual(0);
      expect(requestUpdateSpy).not.toHaveBeenCalled();

      context = new RenderContext(hooks, block, host, updater);
      [count, setCount] = context.useState(0);
      setCount(0);

      expect(count).toEqual(0);
      expect(requestUpdateSpy).not.toHaveBeenCalled();
    });

    it('should return the result of the function as an initial state', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      let context = new RenderContext(hooks, block, host, updater);
      let [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        () => ['foo', 'bar'],
      );
      expect(message).toEqual(['foo', 'bar']);

      addMessage('baz');

      context = new RenderContext(hooks, block, host, updater);
      [message] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        () => ['foo', 'bar'],
      );
      expect(message).toEqual(['foo', 'bar', 'baz']);
    });
  });

  describe('.useSyncEnternalStore()', () => {
    it('should return the snapshot value', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();

      const snapshot = 'foo';
      const subscribers: (() => void)[] = [];
      const subscribe = (subscriber: () => void) => {
        const index = subscribers.push(subscriber) - 1;
        return () => {
          subscribers.splice(index, 1);
        };
      };
      const getSnapshot = () => snapshot;

      const context = new RenderContext(hooks, block, host, updater);

      expect(context.useSyncEnternalStore(subscribe, getSnapshot)).toBe('foo');
    });

    it('should request update with the host priority when changes are notified', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new RenderContext(hooks, block, host, updater);
      const snapshot = 'foo';
      const subscribers: (() => void)[] = [];
      const subscribe = (subscriber: () => void) => {
        const index = subscribers.push(subscriber) - 1;
        return () => {
          subscribers.splice(index, 1);
        };
      };
      const getSnapshot = () => snapshot;

      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');
      const getCurrentPrioritySpy = vi
        .spyOn(host, 'getCurrentPriority')
        .mockReturnValue('user-blocking');

      expect(context.useSyncEnternalStore(subscribe, getSnapshot)).toBe('foo');

      updater.flushUpdate(host);

      for (const subscriber of subscribers) {
        subscriber();
      }

      expect(requestUpdateSpy).toHaveBeenCalledOnce();
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'user-blocking',
        host,
        updater,
      );
      expect(getCurrentPrioritySpy).toHaveBeenCalledOnce();
    });

    it('should request update with a user-specified priority when changes are notified', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new RenderContext(hooks, block, host, updater);
      const snapshot = 'foo';
      const subscribers: (() => void)[] = [];
      const subscribe = (subscriber: () => void) => {
        const index = subscribers.push(subscriber) - 1;
        return () => {
          subscribers.splice(index, 1);
        };
      };
      const getSnapshot = () => snapshot;

      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');
      const getCurrentPrioritySpy = vi
        .spyOn(host, 'getCurrentPriority')
        .mockReturnValue('user-blocking');

      expect(
        context.useSyncEnternalStore(subscribe, getSnapshot, 'background'),
      ).toBe('foo');

      updater.flushUpdate(host);

      for (const subscriber of subscribers) {
        subscriber();
      }

      expect(requestUpdateSpy).toHaveBeenCalledOnce();
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'background',
        host,
        updater,
      );
      expect(getCurrentPrioritySpy).not.toHaveBeenCalled();
    });
  });
});
