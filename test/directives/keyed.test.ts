import { describe, expect, it, vi } from 'vitest';

import {
  PartType,
  UpdateContext,
  directiveTag,
  nameTag,
} from '../../src/baseTypes.js';
import { Keyed, KeyedBinding, keyed } from '../../src/directives/keyed.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import {
  MockBlock,
  MockUpdateHost,
  TextBinding,
  TextDirective,
} from '../mocks.js';

describe('keyed()', () => {
  it('should construct a new Keyed directive', () => {
    const key = 'foo';
    const value = new TextDirective();
    const keyedValue = keyed(key, value);

    expect(keyedValue.key).toBe(key);
    expect(keyedValue.value).toBe(value);
  });
});

describe('Keyed', () => {
  describe('[nameTag]', () => {
    it('should return a string represented itself', () => {
      expect(keyed('foo', 'bar')[nameTag]).toBe('Keyed("foo", "bar")');
    });
  });

  describe('[directiveTag]()', () => {
    it('should create a new KeyedBinding from a non-directive value', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = keyed('foo', new TextDirective('bar'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = value[directiveTag](part, context);

      const getPartSpy = vi.spyOn(binding.binding, 'part', 'get');
      const getStartNodeSpy = vi.spyOn(binding.binding, 'startNode', 'get');
      const getEndNodeSpy = vi.spyOn(binding.binding, 'endNode', 'get');

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.binding).toBeInstanceOf(TextBinding);
      expect(binding.binding.value).toBe(value.value);
      expect(getPartSpy).toHaveBeenCalledOnce();
      expect(getStartNodeSpy).toHaveBeenCalledOnce();
      expect(getEndNodeSpy).toHaveBeenCalledOnce();
    });

    it('should create a new KeyedBinding from a directive value', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = keyed('foo', new TextDirective());
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = value[directiveTag](part, context);

      const getPartSpy = vi.spyOn(binding.binding, 'part', 'get');
      const getStartNodeSpy = vi.spyOn(binding.binding, 'startNode', 'get');
      const getEndNodeSpy = vi.spyOn(binding.binding, 'endNode', 'get');

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.binding).toBeInstanceOf(TextBinding);
      expect(binding.binding.value).toBe(value.value);
      expect(getPartSpy).toHaveBeenCalledOnce();
      expect(getStartNodeSpy).toHaveBeenCalledOnce();
      expect(getEndNodeSpy).toHaveBeenCalledOnce();
    });
  });
});

describe('KeyedBinding', () => {
  describe('.connect()', () => {
    it('should connect the current binding', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = keyed('foo', new TextDirective());
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new KeyedBinding(value, part, context);

      const connectSpy = vi.spyOn(binding.binding, 'connect');

      binding.connect(context);
      context.flushUpdate();

      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.bind()', () => {
    it('should bind the new value to the current binding if the key is the same', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = new Keyed('foo', new TextDirective());
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new KeyedBinding(value, part, context);

      const bindSpy = vi.spyOn(binding.binding, 'bind');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value, context);
      context.flushUpdate();

      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(value.value, context);
    });

    it('should connect a new binding and unbind the old binidng if the key changes', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = new Keyed('foo', new TextDirective());
      const value2 = new Keyed('bar', new TextDirective());
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new KeyedBinding(value1, part, context);

      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.binding.value).toBe(value2.value);
      expect(bindSpy).not.toHaveBeenCalled();
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });

    it('should throw an error if the new value is not Keyed directive', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = keyed('foo', new TextDirective());
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new KeyedBinding(value, part, context);

      expect(() => {
        binding.bind(null as any, context);
      }).toThrow(
        'A value must be a instance of Keyed directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should unbind the current binding', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = keyed('foo', () => new TextDirective());
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new KeyedBinding(value, part, context);

      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.unbind(context);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect the current binding', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = keyed('foo', () => new TextDirective());
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new KeyedBinding(value, part, context);

      const disconnectSpy = vi.spyOn(binding.binding, 'disconnect');

      binding.disconnect(context);

      expect(disconnectSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledWith(context);
    });
  });
});
