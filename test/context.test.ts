import { describe, expect, it, vi } from 'vitest';

import { RenderingContext, usableTag } from '../src/renderingContext.js';
import { RenderingEngine } from '../src/renderingEngine.js';
import { ElementTemplate } from '../src/template/elementTemplate.js';
import { TaggedTemplate } from '../src/template/taggedTemplate.js';

import {
  ChildNodeTemplate,
  TextTemplate,
} from '../src/template/singleTemplate.js';
import { type Hook, HookType } from '../src/types.js';
import { SyncUpdater } from '../src/updater/syncUpdater.js';
import { MockBlock } from './mocks.js';

describe('Context', () => {
  describe('.childNode()', () => {
    it('should return TemplateDirective with ChildNodeTemplate set as a template', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      const context = new RenderingContext(hooks, block, engine, updater);
      const directive = context.childNode('foo');

      expect(directive.template).toBeInstanceOf(ChildNodeTemplate);
      expect(directive.data).toBe('foo');
    });
  });

  describe('.element()', () => {
    it('should return TemplateDirective with ElementTemplate set as a template', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      const context = new RenderingContext(hooks, block, engine, updater);
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

  describe('.finalize()', () => {
    it('should enqueue a Finalizer hook', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      let context = new RenderingContext(hooks, block, engine, updater);
      context.finalize();
      expect(hooks).toEqual([{ type: HookType.Finalizer }]);

      context = new RenderingContext(hooks, block, engine, updater);
      context.finalize();
      expect(hooks).toEqual([{ type: HookType.Finalizer }]);
    });

    it('should throw an error if fewer hooks are used than last time.', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      const context = new RenderingContext(hooks, block, engine, updater);
      context.useEffect(() => {});
      context.finalize();

      expect(() => {
        const context = new RenderingContext(hooks, block, engine, updater);
        context.finalize();
      }).toThrow('Unexpected hook type.');
    });

    it('should throw an error if more hooks are used than last time.', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      const context = new RenderingContext(hooks, block, engine, updater);
      context.finalize();

      expect(() => {
        const context = new RenderingContext(hooks, block, engine, updater);
        context.useEffect(() => {});
      }).toThrow('Unexpected hook type.');
    });
  });

  describe('.getContextValue()', () => {
    it('should get the value from global namespace', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine({ foo: 123 });
      const updater = new SyncUpdater(engine);

      const context = new RenderingContext(hooks, block, engine, updater);
      expect(context.getContextValue('foo')).toBe(123);
      expect(context.getContextValue('bar')).toBeUndefined();
    });

    it('should get the value set on the block', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine({ foo: 123 });
      const updater = new SyncUpdater(engine);

      let context = new RenderingContext(hooks, block, engine, updater);
      context.setContextValue('foo', 456);
      context.setContextValue('bar', 789);
      expect(context.getContextValue('foo')).toBe(456);
      expect(context.getContextValue('bar')).toBe(789);

      context = new RenderingContext(hooks, block, engine, updater);
      expect(context.getContextValue('foo')).toBe(456);
      expect(context.getContextValue('bar')).toBe(789);

      context = new RenderingContext(hooks, new MockBlock(), engine, updater);
      expect(context.getContextValue('foo')).toBe(123);
      expect(context.getContextValue('bar')).toBeUndefined();
    });
  });

  describe('.html()', () => {
    it('should return TemplateDirective with an HTML-formatted TaggedTemplate set as a template', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      const context = new RenderingContext(hooks, block, engine, updater);
      const directive = context.html`
        <div class=${0}>Hello, ${1}!</div>
      `;

      expect(directive.template).toBeInstanceOf(TaggedTemplate);
      expect(
        (directive.template as TaggedTemplate).element.content.firstElementChild
          ?.namespaceURI,
      ).toBe('http://www.w3.org/1999/xhtml');
      expect(directive.data).toEqual([0, 1]);
    });
  });

  describe('.requestUpdate()', () => {
    it('should request update to the current block', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      const context = new RenderingContext(hooks, block, engine, updater);
      context.requestUpdate();

      expect(requestUpdateSpy).toHaveBeenCalledOnce();
      expect(requestUpdateSpy).toHaveBeenCalledWith('user-blocking', updater);
    });
  });

  describe('.svg()', () => {
    it('should return TemplateDirective with an SVG-hormatted TaggedTemplate set as a template', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      const context = new RenderingContext(hooks, block, engine, updater);
      const directive = context.svg`
        <text x=${0} y=${1}>Hello, ${2}!</text>
      `;

      expect(directive.template).toBeInstanceOf(TaggedTemplate);
      expect(
        (directive.template as TaggedTemplate).element.content.firstElementChild
          ?.namespaceURI,
      ).toBe('http://www.w3.org/2000/svg');
      expect(directive.data).toEqual([0, 1, 2]);
    });
  });

  describe('.text()', () => {
    it('should return TemplateDirective with TextTemplate set as a template', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      const context = new RenderingContext(hooks, block, engine, updater);
      const directive = context.text('foo');

      expect(directive.template).toBeInstanceOf(TextTemplate);
      expect(directive.data).toEqual('foo');
    });
  });

  describe('.use()', () => {
    it('should handle the UsableCallback', () => {
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      const context = new RenderingContext(hooks, block, engine, updater);
      const callback = vi.fn(() => 'foo');

      expect(context.use(callback)).toBe('foo');
      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith(context);
    });

    it('should handle the UsableObject', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      const context = new RenderingContext(hooks, block, engine, updater);
      const usable = { [usableTag]: vi.fn(() => 'foo') };

      expect(context.use(usable)).toBe('foo');
      expect(usable[usableTag]).toHaveBeenCalledOnce();
      expect(usable[usableTag]).toHaveBeenCalledWith(context);
    });
  });

  describe('.useCallback()', () => {
    it('should return a memoized callback', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      let context = new RenderingContext(hooks, block, engine, updater);
      const callback1 = () => {};
      expect(context.useCallback(callback1, ['foo'])).toBe(callback1);

      context = new RenderingContext(hooks, block, engine, updater);
      const callback2 = () => {};
      expect(context.useCallback(callback2, ['foo'])).toBe(callback1);

      context = new RenderingContext(hooks, block, engine, updater);
      const callback3 = () => {};
      expect(context.useCallback(callback3, ['bar'])).toBe(callback3);
    });
  });

  describe('.useDeferredValue()', () => {
    it('should return a value deferred until next rendering', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

      let context = new RenderingContext(hooks, block, engine, updater);
      expect(context.useDeferredValue('foo')).toBe('foo');

      updater.flush();
      expect(requestUpdateSpy).toHaveBeenCalledTimes(0);

      context = new RenderingContext(hooks, block, engine, updater);
      expect(context.useDeferredValue('bar')).toBe('foo');

      updater.flush();
      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
      expect(requestUpdateSpy).toHaveBeenCalledWith('background', updater);

      context = new RenderingContext(hooks, block, engine, updater);
      expect(context.useDeferredValue('bar')).toBe('bar');

      updater.flush();
      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
    });

    it('should return a initial value if it is presented', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      let context = new RenderingContext(hooks, block, engine, updater);
      expect(context.useDeferredValue('bar', 'foo')).toBe('foo');

      updater.flush();

      context = new RenderingContext(hooks, block, engine, updater);
      expect(context.useDeferredValue('baz')).toBe('bar');

      updater.flush();

      context = new RenderingContext(hooks, block, engine, updater);
      expect(context.useDeferredValue('baz')).toBe('baz');
    });
  });

  describe('.useEffect()', () => {
    it('should enqueue a callback as a passive effect', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);
      const enqueuePassiveEffectSpy = vi.spyOn(updater, 'enqueuePassiveEffect');

      const effect = vi.fn();

      let context = new RenderingContext(hooks, block, engine, updater);
      context.useEffect(effect);
      updater.flush();

      expect(effect).toHaveBeenCalledTimes(1);
      expect(enqueuePassiveEffectSpy).toHaveBeenCalledTimes(1);

      context = new RenderingContext(hooks, block, engine, updater);
      context.useEffect(effect);
      updater.flush();

      expect(effect).toHaveBeenCalledTimes(2);
      expect(enqueuePassiveEffectSpy).toHaveBeenCalledTimes(2);
    });

    it('should perform a cleanup function when a new effect is enqueued', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      const cleanup = vi.fn();
      const effect = vi.fn().mockReturnValue(cleanup);

      let context = new RenderingContext(hooks, block, engine, updater);
      context.useEffect(effect);
      updater.flush();

      expect(cleanup).not.toHaveBeenCalled();
      expect(effect).toHaveBeenCalledTimes(1);

      context = new RenderingContext(hooks, block, engine, updater);
      context.useEffect(effect);
      updater.flush();

      expect(cleanup).toHaveBeenCalledOnce();
      expect(effect).toHaveBeenCalledTimes(2);
    });

    it('should not perform an effect function if dependencies are not changed', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      const effect = vi.fn();

      let context = new RenderingContext(hooks, block, engine, updater);
      context.useEffect(effect, []);
      updater.flush();

      expect(effect).toHaveBeenCalledOnce();

      context = new RenderingContext(hooks, block, engine, updater);
      context.useEffect(effect, []);
      updater.flush();

      expect(effect).toHaveBeenCalledOnce();
    });
  });

  describe('.useEvent()', () => {
    it('should always return a stable function', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      let context = new RenderingContext(hooks, block, engine, updater);
      const stableHandler1 = context.useEvent(handler1);
      updater.flush();
      stableHandler1();

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).not.toHaveBeenCalled();

      context = new RenderingContext(hooks, block, engine, updater);
      const stableHandler2 = context.useEvent(handler2);
      updater.flush();
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
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);
      const enqueueLayoutEffectSpy = vi.spyOn(updater, 'enqueueLayoutEffect');

      const effect = vi.fn();

      let context = new RenderingContext(hooks, block, engine, updater);
      context.useLayoutEffect(effect);
      updater.flush();

      expect(effect).toHaveBeenCalledTimes(1);
      expect(enqueueLayoutEffectSpy).toHaveBeenCalledTimes(1);

      context = new RenderingContext(hooks, block, engine, updater);
      context.useLayoutEffect(effect);
      updater.flush();

      expect(effect).toHaveBeenCalledTimes(2);
      expect(enqueueLayoutEffectSpy).toHaveBeenCalledTimes(2);
    });

    it('should perform a cleanup function when a new effect is enqueued', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      const cleanup = vi.fn();
      const effect = vi.fn().mockReturnValue(cleanup);

      let context = new RenderingContext(hooks, block, engine, updater);
      context.useLayoutEffect(effect);
      updater.flush();

      expect(cleanup).not.toHaveBeenCalled();
      expect(effect).toHaveBeenCalledTimes(1);

      context = new RenderingContext(hooks, block, engine, updater);
      context.useLayoutEffect(effect);
      updater.flush();

      expect(cleanup).toHaveBeenCalledOnce();
      expect(effect).toHaveBeenCalledTimes(2);
    });

    it('should not perform an effect function if dependencies are not changed', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      const effect = vi.fn();

      let context = new RenderingContext(hooks, block, engine, updater);
      context.useLayoutEffect(effect, []);
      updater.flush();

      expect(effect).toHaveBeenCalledOnce();

      context = new RenderingContext(hooks, block, engine, updater);
      context.useLayoutEffect(effect, []);
      updater.flush();

      expect(effect).toHaveBeenCalledOnce();
    });
  });

  describe('.useMemo()', () => {
    it('should return a memoized value until dependencies is changed', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      const factory1 = vi.fn().mockReturnValue('foo');
      const factory2 = vi.fn().mockReturnValue('bar');

      let context = new RenderingContext(hooks, block, engine, updater);
      expect(context.useMemo(factory1, ['foo'])).toBe('foo');

      context = new RenderingContext(hooks, block, engine, updater);
      expect(context.useMemo(factory2, ['foo'])).toBe('foo');

      context = new RenderingContext(hooks, block, engine, updater);
      expect(context.useMemo(factory2, ['bar'])).toBe('bar');
    });
  });

  describe('.useReducer()', () => {
    it('should update the state by the current priority', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);
      const getCurrentPrioritySpy = vi
        .spyOn(updater, 'getCurrentPriority')
        .mockReturnValue('user-blocking');
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

      let context = new RenderingContext(hooks, block, engine, updater);
      let [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        [],
      );
      addMessage('foo');

      expect(message).toEqual([]);
      expect(getCurrentPrioritySpy).toHaveBeenCalledTimes(1);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
      expect(requestUpdateSpy).toHaveBeenCalledWith('user-blocking', updater);

      context = new RenderingContext(hooks, block, engine, updater);
      [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        [],
      );
      addMessage('bar');

      expect(message).toEqual(['foo']);
      expect(getCurrentPrioritySpy).toHaveBeenCalledTimes(2);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(2);
      expect(requestUpdateSpy).toHaveBeenCalledWith('user-blocking', updater);

      context = new RenderingContext(hooks, block, engine, updater);
      [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        [],
      );

      expect(message).toEqual(['foo', 'bar']);
    });

    it('should update the state by the priority specified by user', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);
      const getCurrentPrioritySpy = vi
        .spyOn(updater, 'getCurrentPriority')
        .mockReturnValue('user-blocking');
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

      let context = new RenderingContext(hooks, block, engine, updater);
      let [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        [],
      );
      addMessage('foo', 'background');

      expect(message).toEqual([]);
      expect(getCurrentPrioritySpy).not.toHaveBeenCalled();
      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
      expect(requestUpdateSpy).toHaveBeenCalledWith('background', updater);

      context = new RenderingContext(hooks, block, engine, updater);
      [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        [],
      );
      addMessage('bar', 'background');

      expect(message).toEqual(['foo']);
      expect(getCurrentPrioritySpy).not.toHaveBeenCalled();
      expect(requestUpdateSpy).toHaveBeenCalledTimes(2);
      expect(requestUpdateSpy).toHaveBeenCalledWith('background', updater);

      context = new RenderingContext(hooks, block, engine, updater);
      [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        [],
      );

      expect(message).toEqual(['foo', 'bar']);
    });

    it('should skip update the state when the state has not changed', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

      let context = new RenderingContext(hooks, block, engine, updater);
      let [count, addCount] = context.useReducer<number, number>(
        (count, n) => count + n,
        0,
      );
      addCount(0);

      expect(count).toEqual(0);
      expect(requestUpdateSpy).not.toHaveBeenCalled();

      context = new RenderingContext(hooks, block, engine, updater);
      [count] = context.useReducer<number, number>((count, n) => count + n, 0);
      addCount(0);

      expect(count).toEqual(0);
      expect(requestUpdateSpy).not.toHaveBeenCalled();
    });

    it('should return the result of the function as an initial state', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      let context = new RenderingContext(hooks, block, engine, updater);
      let [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        () => ['foo', 'bar'],
      );
      expect(message).toEqual(['foo', 'bar']);

      addMessage('baz');

      context = new RenderingContext(hooks, block, engine, updater);
      [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        () => ['foo', 'bar'],
      );
      expect(message).toEqual(['foo', 'bar', 'baz']);
    });
  });

  describe('.useRef()', () => {
    it('should return a same object', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      let context = new RenderingContext(hooks, block, engine, updater);
      const ref = context.useRef('foo');
      expect(ref).toEqual({ current: 'foo' });

      context = new RenderingContext(hooks, block, engine, updater);
      expect(context.useRef('foo')).toBe(ref);
    });
  });

  describe('.useState()', () => {
    it('should update the state by the current priority', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);
      const getCurrentPrioritySpy = vi
        .spyOn(updater, 'getCurrentPriority')
        .mockReturnValue('user-blocking');
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

      let context = new RenderingContext(hooks, block, engine, updater);
      let [count, setCount] = context.useState(0);
      setCount(1);

      expect(count).toEqual(0);
      expect(getCurrentPrioritySpy).toHaveBeenCalledTimes(1);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
      expect(requestUpdateSpy).toHaveBeenCalledWith('user-blocking', updater);

      context = new RenderingContext(hooks, block, engine, updater);
      [count, setCount] = context.useState(0);
      setCount((n) => n + 2);

      expect(count).toEqual(1);
      expect(getCurrentPrioritySpy).toHaveBeenCalledTimes(2);
      expect(requestUpdateSpy).toHaveBeenCalledTimes(2);
      expect(requestUpdateSpy).toHaveBeenCalledWith('user-blocking', updater);

      context = new RenderingContext(hooks, block, engine, updater);
      [count, setCount] = context.useState(0);

      expect(count).toEqual(3);
    });

    it('should update the state by the priority specified by user', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);
      const getCurrentPrioritySpy = vi
        .spyOn(updater, 'getCurrentPriority')
        .mockReturnValue('user-blocking');
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

      let context = new RenderingContext(hooks, block, engine, updater);
      let [count, setCount] = context.useState(0);
      setCount(1, 'background');

      expect(count).toEqual(0);
      expect(getCurrentPrioritySpy).not.toHaveBeenCalled();
      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
      expect(requestUpdateSpy).toHaveBeenCalledWith('background', updater);

      context = new RenderingContext(hooks, block, engine, updater);
      [count, setCount] = context.useState(0);
      setCount((n) => n + 2, 'background');

      expect(count).toEqual(1);
      expect(getCurrentPrioritySpy).not.toHaveBeenCalled();
      expect(requestUpdateSpy).toHaveBeenCalledTimes(2);
      expect(requestUpdateSpy).toHaveBeenCalledWith('background', updater);

      context = new RenderingContext(hooks, block, engine, updater);
      [count, setCount] = context.useState(0);

      expect(count).toEqual(3);
    });

    it('should skip update the state when the state has not changed', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

      let context = new RenderingContext(hooks, block, engine, updater);
      let [count, setCount] = context.useState(0);
      setCount(0);

      expect(count).toEqual(0);
      expect(requestUpdateSpy).not.toHaveBeenCalled();

      context = new RenderingContext(hooks, block, engine, updater);
      [count, setCount] = context.useState(0);
      setCount(0);

      expect(count).toEqual(0);
      expect(requestUpdateSpy).not.toHaveBeenCalled();
    });

    it('should return the result of the function as an initial state', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      let context = new RenderingContext(hooks, block, engine, updater);
      let [message, addMessage] = context.useReducer<string[], string>(
        (messages, message) => [...messages, message],
        () => ['foo', 'bar'],
      );
      expect(message).toEqual(['foo', 'bar']);

      addMessage('baz');

      context = new RenderingContext(hooks, block, engine, updater);
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
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);

      const snapshot = 'foo';
      const subscribers: (() => void)[] = [];
      const subscribe = (subscriber: () => void) => {
        const index = subscribers.push(subscriber) - 1;
        return () => {
          subscribers.splice(index, 1);
        };
      };
      const getSnapshot = () => snapshot;

      const context = new RenderingContext(hooks, block, engine, updater);

      expect(context.useSyncEnternalStore(subscribe, getSnapshot)).toBe('foo');
    });

    it('should request update to the block by the current priority when changes are notified to subscribers', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');
      const getCurrentPrioritySpy = vi
        .spyOn(updater, 'getCurrentPriority')
        .mockReturnValue('user-blocking');

      const snapshot = 'foo';
      const subscribers: (() => void)[] = [];
      const subscribe = (subscriber: () => void) => {
        const index = subscribers.push(subscriber) - 1;
        return () => {
          subscribers.splice(index, 1);
        };
      };
      const getSnapshot = () => snapshot;

      const context = new RenderingContext(hooks, block, engine, updater);

      expect(context.useSyncEnternalStore(subscribe, getSnapshot)).toBe('foo');

      updater.flush();
      subscribers.forEach((f) => f());

      expect(requestUpdateSpy).toHaveBeenCalledOnce();
      expect(requestUpdateSpy).toHaveBeenCalledWith('user-blocking', updater);
      expect(getCurrentPrioritySpy).toHaveBeenCalledOnce();
    });

    it('should request update to the block by the priority specified by user when changes are notified to subscribers', () => {
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const engine = new RenderingEngine();
      const updater = new SyncUpdater(engine);
      const requestUpdateSpy = vi.spyOn(block, 'requestUpdate');

      const snapshot = 'foo';
      const subscribers: (() => void)[] = [];
      const subscribe = (subscriber: () => void) => {
        const index = subscribers.push(subscriber) - 1;
        return () => {
          subscribers.splice(index, 1);
        };
      };
      const getSnapshot = () => snapshot;

      let context = new RenderingContext(hooks, block, engine, updater);

      expect(
        context.useSyncEnternalStore(subscribe, getSnapshot, 'user-blocking'),
      ).toBe('foo');

      updater.flush();
      subscribers.forEach((f) => f());

      expect(requestUpdateSpy).toHaveBeenCalledTimes(1);
      expect(requestUpdateSpy).toHaveBeenCalledWith('user-blocking', updater);

      context = new RenderingContext(hooks, block, engine, updater);

      expect(
        context.useSyncEnternalStore(subscribe, getSnapshot, 'background'),
      ).toBe('foo');

      updater.flush();
      subscribers.forEach((f) => f());

      expect(requestUpdateSpy).toHaveBeenCalledTimes(2);
      expect(requestUpdateSpy).toHaveBeenCalledWith('background', updater);
    });
  });
});
