import { describe, expect, it, vi } from 'vitest';

import {
  PartType,
  UpdateContext,
  directiveTag,
  nameTag,
} from '../../src/baseTypes.js';
import { MemoBinding, memo } from '../../src/directives/memo.js';
import { SyncUpdater } from '../../src/updaters/syncUpdater.js';
import {
  MockBlock,
  MockRenderHost,
  TextBinding,
  TextDirective,
} from '../mocks.js';

describe('memo()', () => {
  it('should construct a new Memo directive', () => {
    const factory = () => new TextDirective();
    const dependencies = ['foo'];
    const value = memo(factory, dependencies);

    expect(value.factory).toBe(factory);
    expect(value.dependencies).toBe(dependencies);
  });
});

describe('Memo', () => {
  describe('[nameTag]', () => {
    it('should return a string represented itself', () => {
      expect(memo(() => 'foo', [])[nameTag]).toBe('Memo("foo")');
    });
  });

  describe('[directiveTag]()', () => {
    it('should create a new MemoBinding from the non-directive value', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const memoizedValue = new TextDirective('foo');
      const factory = vi.fn(() => memoizedValue);
      const value = memo(factory, ['foo']);
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = value[directiveTag](part, context);

      const getPartSpy = vi.spyOn(binding.binding, 'part', 'get');
      const getStartNodeSpy = vi.spyOn(binding.binding, 'startNode', 'get');
      const getEndNodeSpy = vi.spyOn(binding.binding, 'endNode', 'get');

      expect(factory).toHaveBeenCalledOnce();
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.binding).toBeInstanceOf(TextBinding);
      expect(binding.binding.value).toBe(memoizedValue);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(getPartSpy).toHaveBeenCalledOnce();
      expect(getStartNodeSpy).toHaveBeenCalledOnce();
      expect(getEndNodeSpy).toHaveBeenCalledOnce();
    });

    it('should create a new MemoBinding from the directive value', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const factory = vi.fn(() => new TextDirective());
      const value = memo(factory, ['foo']);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = value[directiveTag](part, context);

      const getPartSpy = vi.spyOn(binding.binding, 'part', 'get');
      const getStartNodeSpy = vi.spyOn(binding.binding, 'startNode', 'get');
      const getEndNodeSpy = vi.spyOn(binding.binding, 'endNode', 'get');

      expect(factory).toHaveBeenCalledOnce();
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.binding).toBeInstanceOf(TextBinding);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(getPartSpy).toHaveBeenCalledOnce();
      expect(getStartNodeSpy).toHaveBeenCalledOnce();
      expect(getEndNodeSpy).toHaveBeenCalledOnce();
    });
  });
});

describe('MemoBinding', () => {
  describe('.connect()', () => {
    it('should connect the current binding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = memo(() => new TextDirective(), ['foo']);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new MemoBinding(value, part, context);

      const connectSpy = vi.spyOn(binding.binding, 'connect');

      binding.connect(context);

      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.bind()', () => {
    it('should delete to the inner binding if dependencies are changed', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = memo(() => new TextDirective(), ['foo']);
      const value2 = memo(() => new TextDirective(), ['bar']);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new MemoBinding(value1, part, context);

      const bindSpy = vi.spyOn(binding.binding, 'bind');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.value).toBe(value2);
      expect(bindSpy).toHaveBeenCalledOnce();
    });

    it('should skip an update if dependencies are not changed', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = memo(() => new TextDirective(), ['foo']);
      const value2 = memo(value1.factory, value1.dependencies);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new MemoBinding(value1, part, context);

      const bindSpy = vi.spyOn(binding.binding, 'bind');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.value).toBe(value2);
      expect(bindSpy).not.toHaveBeenCalled();
    });

    it('should throw an error if the new value is not Memo directive', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = memo(() => new TextDirective(), ['foo']);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new MemoBinding(value, part, context);

      expect(() => {
        binding.bind(null as any, context);
      }).toThrow(
        'A value must be a instance of Memo directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should unbind the current binding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = memo(() => new TextDirective(), ['foo']);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new MemoBinding(value, part, context);

      const connectSpy = vi.spyOn(binding.binding, 'connect');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      expect(binding.value).toBe(value);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });

    it('should always bind a new value to the current binding after unbounding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const memoizedValue = new TextDirective();
      const value = memo(() => memoizedValue, ['foo']);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new MemoBinding(value, part, context);

      const connectSpy = vi.spyOn(binding.binding, 'connect');
      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      binding.bind(value, context);
      context.flushUpdate();

      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(binding.value).toBe(value);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(memoizedValue, context);
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect the current binding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = memo(() => new TextDirective(), ['foo']);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new MemoBinding(value, part, context);

      const connectSpy = vi.spyOn(binding.binding, 'connect');
      const disconnectSpy = vi.spyOn(binding.binding, 'disconnect');

      binding.connect(context);
      context.flushUpdate();

      binding.disconnect(context);

      expect(binding.value).toBe(value);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
    });

    it('should always bind a new value to the current binding after disconnecting', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const memoizedValue = new TextDirective();
      const value = memo(() => memoizedValue, ['foo']);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new MemoBinding(value, part, context);

      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const connectSpy = vi.spyOn(binding.binding, 'connect');
      const disconnectSpy = vi.spyOn(binding.binding, 'disconnect');

      binding.connect(context);
      context.flushUpdate();

      binding.disconnect(context);

      binding.bind(value, context);
      context.flushUpdate();

      expect(binding.value).toBe(value);
      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(memoizedValue, context);
      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
    });
  });
});
