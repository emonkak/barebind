import { describe, expect, it, vi } from 'vitest';

import { type Hook, HookType, createUpdateQueue } from '../src/baseTypes.js';
import { RenderContext, usableTag } from '../src/renderContext.js';
import { ElementTemplate } from '../src/template/elementTemplate.js';
import { EmptyTemplate } from '../src/template/emptyTemplate.js';
import {
  ChildNodeTemplate,
  TextTemplate,
} from '../src/template/singleTemplate.js';
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
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      const context = new RenderContext(host, updater, block, hooks, queue);
      const value = context.childNode('foo');

      expect(value.template).toBeInstanceOf(ChildNodeTemplate);
      expect(value.data).toBe('foo');
    });
  });

  describe('.element()', () => {
    it('should return Fragment with ElementTemplate set as a template', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      const context = new RenderContext(host, updater, block, hooks, queue);
      const value = context.element('div', { class: 'foo', id: 'bar' }, 'baz');

      expect(value.template).toBeInstanceOf(ElementTemplate);
      expect(value.data).toEqual({
        elementValue: { class: 'foo', id: 'bar' },
        childNodeValue: 'baz',
      });
    });
  });

  describe('.empty()', () => {
    it('should return Fragment with EmptyTemplate set as a template', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      const context = new RenderContext(host, updater, block, hooks, queue);
      const value = context.empty();

      expect(value.template).toBe(EmptyTemplate.instance);
      expect(value.data).toEqual(null);
    });
  });

  describe('.finalize()', () => {
    it('should enqueue a Finalizer hook', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      context.finalize();

      expect(hooks).toEqual([{ type: HookType.Finalizer }]);

      context = new RenderContext(host, updater, block, hooks, queue);
      context.finalize();

      expect(hooks).toEqual([{ type: HookType.Finalizer }]);
    });

    it('should throw an error if a hook is added after finalization', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      expect(() => {
        const context = new RenderContext(host, updater, block, hooks, queue);
        context.finalize();
        context.useEffect(() => {});
      }).toThrow('Cannot add property');
    });

    it('should throw an error if fewer hooks are used than last time', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      const context = new RenderContext(host, updater, block, hooks, queue);

      context.useEffect(() => {});
      context.finalize();

      expect(() => {
        const context = new RenderContext(host, updater, block, hooks, queue);
        context.finalize();
      }).toThrow('Unexpected hook type.');
    });

    it('should throw an error if more hooks are used than last time', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      const context = new RenderContext(host, updater, block, hooks, queue);

      context.finalize();

      expect(() => {
        const context = new RenderContext(host, updater, block, hooks, queue);
        context.useEffect(() => {});
      }).toThrow('Unexpected hook type.');
    });
  });

  describe('.getContextValue()', () => {
    it('should get a value from the block scope', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      const context = new RenderContext(host, updater, block, hooks, queue);
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
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      const context = new RenderContext(host, updater, block, hooks, queue);
      const getHTMLTemplateSpy = vi.spyOn(host, 'getHTMLTemplate');

      const result = context.html`
        <div class=${0}>Hello, ${1}!</div>
      `;

      expect(result.template).toBeInstanceOf(MockTemplate);
      expect(result.data).toStrictEqual([0, 1]);
      expect(getHTMLTemplateSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.isFirstRender()', () => {
    it('should check whether the render is the first one', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);

      expect(context.isFirstRender()).toBe(true);
      context.finalize();
      expect(context.isFirstRender()).toBe(false);

      context = new RenderContext(host, updater, block, hooks, queue);

      expect(context.isFirstRender()).toBe(false);
      context.finalize();
      expect(context.isFirstRender()).toBe(false);
    });
  });

  describe('.isRendering()', () => {
    it('should check whether the render is in progress', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);

      expect(context.isRendering()).toBe(true);
      context.finalize();
      expect(context.isRendering()).toBe(false);

      context = new RenderContext(host, updater, block, hooks, queue);

      expect(context.isRendering()).toBe(true);
      context.finalize();
      expect(context.isRendering()).toBe(false);
    });
  });

  describe('.forceUpdate()', () => {
    it('should request update with the given priority', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

      context = new RenderContext(host, updater, block, hooks, queue);
      context.forceUpdate('background');

      expect(requestUpdateSpy).toHaveBeenCalledOnce();
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'background',
        expect.objectContaining({ host, updater, block, queue }),
      );
    });

    it('should request update with the host priority', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      const context = new RenderContext(host, updater, block, hooks, queue);
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');
      const getCurrentPrioritySpy = vi
        .spyOn(host, 'getCurrentPriority')
        .mockReturnValue('user-blocking');

      context.forceUpdate();

      expect(requestUpdateSpy).toHaveBeenCalledOnce();
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'user-blocking',
        expect.objectContaining({ host, updater, block, queue }),
      );
      expect(getCurrentPrioritySpy).toHaveBeenCalledOnce();
    });
  });

  describe('.setContextValue()', () => {
    it('should set a value to the block scope', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      const context = new RenderContext(host, updater, block, hooks, queue);
      const setScopedValueSpy = vi.spyOn(host, 'setScopedValue');

      context.setContextValue('foo', 123);

      expect(setScopedValueSpy).toHaveBeenCalledOnce();
      expect(setScopedValueSpy).toHaveBeenCalledWith('foo', 123, block);
    });
  });

  describe('.svg()', () => {
    it('should return Fragment with an SVG-hormatted TaggedTemplate set as a template', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      const context = new RenderContext(host, updater, block, hooks, queue);
      const getSVGTemplateSpy = vi.spyOn(host, 'getSVGTemplate');

      const result = context.svg`
        <text x=${0} y=${1}>Hello, ${2}!</text>
      `;

      expect(result.template).toBeInstanceOf(MockTemplate);
      expect(result.data).toStrictEqual([0, 1, 2]);
      expect(getSVGTemplateSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.text()', () => {
    it('should return FragmenFragment TextTemplate set as a template', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      const context = new RenderContext(host, updater, block, hooks, queue);
      const value = context.text('foo');

      expect(value.template).toBeInstanceOf(TextTemplate);
      expect(value.data).toEqual('foo');
    });
  });

  describe('.use()', () => {
    it('should handle the UsableCallback', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      const context = new RenderContext(host, updater, block, hooks, queue);
      const callback = vi.fn(() => 'foo');

      expect(context.use(callback)).toBe('foo');
      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith(context);
    });

    it('should handle the UsableObject', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      const context = new RenderContext(host, updater, block, hooks, queue);
      const usable = new MockUsableObject('foo');
      const usableSpy = vi.spyOn(usable, usableTag);

      expect(context.use(usable)).toBe('foo');
      expect(usableSpy).toHaveBeenCalledOnce();
      expect(usableSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.useCallback()', () => {
    it('should return a memoized callback', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      const callback1 = () => {};
      const callback2 = () => {};
      const callback3 = () => {};

      expect(context.useCallback(callback1, ['foo'])).toBe(callback1);

      context = new RenderContext(host, updater, block, hooks, queue);

      expect(context.useCallback(callback2, ['foo'])).toBe(callback1);

      context = new RenderContext(host, updater, block, hooks, queue);

      expect(context.useCallback(callback3, ['bar'])).toBe(callback3);
    });
  });

  describe('.useDeferredValue()', () => {
    it('should return a value deferred until next rendering', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

      expect(context.useDeferredValue('foo')).toBe('foo');
      updater.flushUpdate(queue, host);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(0);

      context = new RenderContext(host, updater, block, hooks, queue);

      expect(context.useDeferredValue('bar')).toBe('foo');
      updater.flushUpdate(queue, host);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'background',
        expect.objectContaining({ host, updater, block, queue }),
      );

      context = new RenderContext(host, updater, block, hooks, queue);

      expect(context.useDeferredValue('bar')).toBe('bar');
      updater.flushUpdate(queue, host);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
    });

    it('should return a initial value if it is presented', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();
      let context = new RenderContext(host, updater, block, hooks, queue);

      expect(context.useDeferredValue('bar', 'foo')).toBe('foo');
      updater.flushUpdate(queue, host);

      context = new RenderContext(host, updater, block, hooks, queue);

      expect(context.useDeferredValue('baz')).toBe('bar');
      updater.flushUpdate(queue, host);

      context = new RenderContext(host, updater, block, hooks, queue);

      expect(context.useDeferredValue('baz')).toBe('baz');
    });
  });

  describe('.useEffect()', () => {
    it('should perform a cleanup function when a new effect is enqueued', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      const cleanupFn = vi.fn();
      const effectFn = vi.fn().mockReturnValue(cleanupFn);

      context.useEffect(effectFn);

      expect(queue.passiveEffects).toHaveLength(1);
      updater.flushUpdate(queue, host);
      expect(effectFn).toHaveBeenCalledTimes(1);
      expect(cleanupFn).not.toHaveBeenCalled();

      context = new RenderContext(host, updater, block, hooks, queue);

      context.useEffect(effectFn);

      expect(queue.passiveEffects).toHaveLength(1);
      updater.flushUpdate(queue, host);
      expect(effectFn).toHaveBeenCalledTimes(2);
      expect(cleanupFn).toHaveBeenCalledOnce();
    });

    it('should not perform an effect function if dependencies are not changed', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      const effectFn = vi.fn();

      context.useEffect(effectFn, []);

      expect(queue.passiveEffects).toHaveLength(1);
      updater.flushUpdate(queue, host);
      expect(effectFn).toHaveBeenCalledOnce();

      context = new RenderContext(host, updater, block, hooks, queue);

      context.useEffect(effectFn, []);

      expect(queue.passiveEffects).toHaveLength(0);
      updater.flushUpdate(queue, host);
      expect(effectFn).toHaveBeenCalledOnce();
    });
  });

  describe('.useEvent()', () => {
    it('should always return a stable function', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const eventHandler1 = context.useEvent(handler1);
      updater.flushUpdate(queue, host);
      eventHandler1();

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).not.toHaveBeenCalled();

      context = new RenderContext(host, updater, block, hooks, queue);

      const eventHandler2 = context.useEvent(handler2);
      updater.flushUpdate(queue, host);
      eventHandler2();

      expect(eventHandler2).toBe(eventHandler1);
      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });
  });

  describe('.useId()', () => {
    it('should return a unique identifier', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);

      const id1 = context.useId();
      const id2 = context.useId();
      expect(id1).toBe(':__test__-1:');
      expect(id2).toBe(':__test__-2:');

      context = new RenderContext(host, updater, block, hooks, queue);

      expect(context.useId()).toBe(id1);
      expect(context.useId()).toBe(id2);
    });
  });

  describe('.useLayoutEffect()', () => {
    it('should perform a cleanup function when a new effect is enqueued', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      const cleanupFn = vi.fn();
      const effectFn = vi.fn().mockReturnValue(cleanupFn);

      context.useLayoutEffect(effectFn);
      expect(queue.layoutEffects).toHaveLength(1);
      updater.flushUpdate(queue, host);

      expect(effectFn).toHaveBeenCalledTimes(1);
      expect(cleanupFn).not.toHaveBeenCalled();

      context = new RenderContext(host, updater, block, hooks, queue);

      context.useLayoutEffect(effectFn);
      expect(queue.layoutEffects).toHaveLength(1);
      updater.flushUpdate(queue, host);

      expect(effectFn).toHaveBeenCalledTimes(2);
      expect(cleanupFn).toHaveBeenCalledOnce();
    });

    it('should not perform an effect function if dependencies are not changed', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      const effectFn = vi.fn();

      context.useLayoutEffect(effectFn, []);
      expect(queue.layoutEffects).toHaveLength(1);
      updater.flushUpdate(queue, host);

      expect(effectFn).toHaveBeenCalledOnce();

      context = new RenderContext(host, updater, block, hooks, queue);

      context.useLayoutEffect(effectFn, []);
      expect(queue.layoutEffects).toHaveLength(0);
      updater.flushUpdate(queue, host);

      expect(effectFn).toHaveBeenCalledOnce();
    });
  });

  describe('.useMemo()', () => {
    it('should return a memoized value until dependencies is changed', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      const factoryFn1 = vi.fn().mockReturnValue('foo');
      const factoryFn2 = vi.fn().mockReturnValue('bar');

      expect(context.useMemo(factoryFn1, ['foo'])).toBe('foo');

      context = new RenderContext(host, updater, block, hooks, queue);

      expect(context.useMemo(factoryFn2, ['foo'])).toBe('foo');

      context = new RenderContext(host, updater, block, hooks, queue);

      expect(context.useMemo(factoryFn2, ['bar'])).toBe('bar');
    });
  });

  describe('.useReducer()', () => {
    it('should request update with "inherit" priority', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');
      const getCurrentPrioritySpy = vi
        .spyOn(host, 'getCurrentPriority')
        .mockReturnValue('user-blocking');
      let [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        [],
      );
      addMessage('foo');

      expect(message).toEqual([]);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'user-blocking',
        expect.objectContaining({ host, updater, block, queue }),
      );
      expect(getCurrentPrioritySpy).toHaveBeenCalledTimes(1);

      context = new RenderContext(host, updater, block, hooks, queue);
      [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        [],
      );
      addMessage('bar');

      expect(message).toEqual(['foo']);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(2);
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'user-blocking',
        expect.objectContaining({ host, updater, block, queue }),
      );
      expect(getCurrentPrioritySpy).toHaveBeenCalledTimes(2);

      context = new RenderContext(host, updater, block, hooks, queue);
      [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        [],
      );

      expect(message).toEqual(['foo', 'bar']);
    });

    it('should request update with user-specified priority', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

      let [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        [],
      );
      addMessage('foo', 'user-blocking');

      expect(message).toEqual([]);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'user-blocking',
        expect.objectContaining({ host, updater, block, queue }),
      );

      context = new RenderContext(host, updater, block, hooks, queue);
      [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        [],
      );
      addMessage('bar', 'background');

      expect(message).toEqual(['foo']);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(2);
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'background',
        expect.objectContaining({ host, updater, block, queue }),
      );

      context = new RenderContext(host, updater, block, hooks, queue);
      [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        [],
      );

      expect(message).toEqual(['foo', 'bar']);
    });

    it('should skip request update if the state has not changed', () => {
      const hooks: Hook[] = [];
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');
      let [count, addCount] = context.useReducer<number, number>(
        (count, n) => count + n,
        0,
      );
      addCount(0);

      expect(count).toEqual(0);
      expect(requestUpdateSpy).not.toHaveBeenCalled();

      context = new RenderContext(host, updater, block, hooks, queue);
      [count] = context.useReducer<number, number>((count, n) => count + n, 0);
      addCount(0);

      expect(count).toEqual(0);
      expect(requestUpdateSpy).not.toHaveBeenCalled();
    });

    it('should return the function result as an initial state', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      let [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        () => ['foo', 'bar'],
      );
      addMessage('baz');

      expect(message).toEqual(['foo', 'bar']);

      context = new RenderContext(host, updater, block, hooks, queue);
      [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        () => ['foo', 'bar'],
      );

      expect(message).toEqual(['foo', 'bar', 'baz']);
    });

    it('should always return the same dispatcher', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      const [message1, addMessage1] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        () => ['foo', 'bar'],
      );

      context = new RenderContext(host, updater, block, hooks, queue);
      const [message2, addMessage2] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        () => ['foo', 'bar'],
      );

      expect(message1).toBe(message2);
      expect(addMessage1).toBe(addMessage2);
    });
  });

  describe('.useRef()', () => {
    it('should return the same object', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      const ref = context.useRef('foo');

      expect(ref).toEqual({ current: 'foo' });

      context = new RenderContext(host, updater, block, hooks, queue);

      expect(context.useRef('foo')).toBe(ref);
    });
  });

  describe('.useState()', () => {
    it('should request update with the host priority', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');
      const getCurrentPrioritySpy = vi
        .spyOn(host, 'getCurrentPriority')
        .mockReturnValue('user-blocking');
      let [count, setCount] = context.useState(0);
      setCount(1);

      expect(count).toEqual(0);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'user-blocking',
        expect.objectContaining({ host, updater, block, queue }),
      );
      expect(getCurrentPrioritySpy).toHaveBeenCalledTimes(1);

      context = new RenderContext(host, updater, block, hooks, queue);
      [count, setCount] = context.useState(0);
      setCount((n) => n + 2);

      expect(count).toEqual(1);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(2);
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'user-blocking',
        expect.objectContaining({ host, updater, block, queue }),
      );
      expect(getCurrentPrioritySpy).toHaveBeenCalledTimes(2);

      context = new RenderContext(host, updater, block, hooks, queue);
      [count, setCount] = context.useState(0);

      expect(count).toEqual(3);
    });

    it('should request update with user-specified priority', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

      let [count, setCount] = context.useState(0);
      setCount(1, 'user-blocking');

      expect(count).toEqual(0);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'user-blocking',
        expect.objectContaining({ host, updater, block, queue }),
      );

      context = new RenderContext(host, updater, block, hooks, queue);
      [count, setCount] = context.useState(0);
      setCount((n) => n + 2, 'background');

      expect(count).toEqual(1);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(2);
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'background',
        expect.objectContaining({ host, updater, block, queue }),
      );

      context = new RenderContext(host, updater, block, hooks, queue);
      [count, setCount] = context.useState(0);

      expect(count).toEqual(3);
    });

    it('should skip requst update if the state has not changed', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');
      let [count, setCount] = context.useState(0);
      setCount(0);

      expect(count).toEqual(0);
      expect(requestUpdateSpy).not.toHaveBeenCalled();

      context = new RenderContext(host, updater, block, hooks, queue);
      [count, setCount] = context.useState(0);
      setCount(0);

      expect(count).toEqual(0);
      expect(requestUpdateSpy).not.toHaveBeenCalled();
    });

    it('should return the result of the function as an initial state', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      let context = new RenderContext(host, updater, block, hooks, queue);
      let [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        () => ['foo', 'bar'],
      );
      expect(message).toEqual(['foo', 'bar']);

      addMessage('baz');

      context = new RenderContext(host, updater, block, hooks, queue);
      [message] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        () => ['foo', 'bar'],
      );
      expect(message).toEqual(['foo', 'bar', 'baz']);
    });
  });

  describe('.useSyncEnternalStore()', () => {
    it('should return the snapshot value', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      const context = new RenderContext(host, updater, block, hooks, queue);
      const snapshot = 'foo';
      const subscribers: (() => void)[] = [];
      const subscribe = (subscriber: () => void) => {
        const index = subscribers.push(subscriber) - 1;
        return () => {
          subscribers.splice(index, 1);
        };
      };
      const getSnapshot = () => snapshot;

      expect(context.useSyncEnternalStore(subscribe, getSnapshot)).toBe('foo');
    });

    it('should request update with the host priority when changes are notified', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      const context = new RenderContext(host, updater, block, hooks, queue);
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

      updater.flushUpdate(queue, host);

      for (const subscriber of subscribers) {
        subscriber();
      }

      expect(requestUpdateSpy).toHaveBeenCalledOnce();
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'user-blocking',
        expect.objectContaining({ host, updater, block, queue }),
      );
      expect(getCurrentPrioritySpy).toHaveBeenCalledOnce();
    });

    it('should request update with a user-specified priority when changes are notified', () => {
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const queue = createUpdateQueue();

      const context = new RenderContext(host, updater, block, hooks, queue);
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

      updater.flushUpdate(queue, host);

      for (const subscriber of subscribers) {
        subscriber();
      }

      expect(requestUpdateSpy).toHaveBeenCalledOnce();
      expect(requestUpdateSpy).toHaveBeenCalledWith(
        'background',
        expect.objectContaining({ host, updater, block, queue }),
      );
      expect(getCurrentPrioritySpy).not.toHaveBeenCalled();
    });
  });
});
