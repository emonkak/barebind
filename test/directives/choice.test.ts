import { describe, expect, it, vi } from 'vitest';

import {
  PartType,
  UpdateContext,
  directiveTag,
  nameTag,
} from '../../src/baseTypes.js';
import { NodeBinding } from '../../src/binding.js';
import { Choice, ChoiceBinding, choice } from '../../src/directives/choice.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockUpdateHost, TextBinding, TextDirective } from '../mocks.js';

describe('choice()', () => {
  it('should construct a new Choice directive', () => {
    const key = 'foo';
    const factory = () => new TextDirective();
    const value = choice(key, factory);

    expect(value.key).toBe(key);
    expect(value.factory).toBe(factory);
  });
});

describe('Choice', () => {
  describe('[nameTag]', () => {
    it('should return a string represented itself', () => {
      expect(choice('foo', (key) => key)[nameTag]).toBe('Choice("foo", "foo")');
      expect(choice('bar', (key) => key)[nameTag]).toBe('Choice("bar", "bar")');
    });
  });

  describe('[directiveTag]()', () => {
    it('should return a new ChoiceBinding from a non-directive value', () => {
      const factory = vi.fn((key: 'foo' | 'bar') => key);
      const value = choice('foo', factory);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);
      const binding = value[directiveTag](part, context);
      const getPartSpy = vi.spyOn(binding.binding, 'part', 'get');
      const getStartNodeSpy = vi.spyOn(binding.binding, 'startNode', 'get');
      const getEndNodeSpy = vi.spyOn(binding.binding, 'endNode', 'get');

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.binding).toBeInstanceOf(NodeBinding);
      expect(binding.binding.value).toBe('foo');
      expect(factory).toHaveBeenCalledOnce();
      expect(factory).toHaveBeenCalledWith('foo');
      expect(getPartSpy).toHaveBeenCalledOnce();
      expect(getStartNodeSpy).toHaveBeenCalledOnce();
      expect(getEndNodeSpy).toHaveBeenCalledOnce();
    });

    it('should return a new ChoiceBinding from a directive value', () => {
      const fooDirective = new TextDirective();
      const barDirective = new TextDirective();
      const factory = vi.fn((key: 'foo' | 'bar') => {
        switch (key) {
          case 'foo':
            return fooDirective;
          case 'bar':
            return barDirective;
        }
      });
      const value = choice('foo', factory);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);
      const binding = value[directiveTag](part, context);
      const getPartSpy = vi.spyOn(binding.binding, 'part', 'get');
      const getStartNodeSpy = vi.spyOn(binding.binding, 'startNode', 'get');
      const getEndNodeSpy = vi.spyOn(binding.binding, 'endNode', 'get');

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.binding).toBeInstanceOf(TextBinding);
      expect(binding.binding.value).toBe(fooDirective);
      expect(factory).toHaveBeenCalledOnce();
      expect(factory).toHaveBeenCalledWith('foo');
      expect(getPartSpy).toHaveBeenCalledOnce();
      expect(getStartNodeSpy).toHaveBeenCalledOnce();
      expect(getEndNodeSpy).toHaveBeenCalledOnce();
    });
  });
});

describe('ChoiceBinding', () => {
  describe('.connect()', () => {
    it('should delegate to the current binding', () => {
      const value = choice('foo', () => new TextDirective());
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);
      const binding = new ChoiceBinding(value, part, context);
      const connectSpy = vi.spyOn(binding.binding, 'connect');

      binding.connect(context);
      context.flushUpdate();

      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.bind()', () => {
    it('should bind the new value to the current binding if the key is the same', () => {
      const fooDirective = new TextDirective();
      const barDirective = new TextDirective();
      const fooDirectiveSpy = vi.spyOn(fooDirective, directiveTag);
      const barDirectiveSpy = vi.spyOn(barDirective, directiveTag);
      const factory = vi.fn((key: 'foo' | 'bar') => {
        switch (key) {
          case 'foo':
            return fooDirective;
          case 'bar':
            return barDirective;
        }
      });
      const value = new Choice<'foo' | 'bar', TextDirective>('foo', factory);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);
      const binding = new ChoiceBinding(value, part, context);
      const bindSpy = vi.spyOn(binding.binding, 'bind');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value, context);
      context.flushUpdate();

      expect(binding.binding.value).toBe(fooDirective);
      expect(fooDirectiveSpy).toHaveBeenCalledOnce();
      expect(barDirectiveSpy).not.toHaveBeenCalled();
      expect(factory).toHaveBeenCalledTimes(2);
      expect(factory).toHaveBeenNthCalledWith(1, 'foo');
      expect(factory).toHaveBeenNthCalledWith(2, 'foo');
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(barDirective, context);
    });

    it('should connect a new binding and unbind the old binidng if the key changes', () => {
      const fooDirective = new TextDirective();
      const barDirective = new TextDirective();
      const fooDirectiveSpy = vi.spyOn(fooDirective, directiveTag);
      const barDirectiveSpy = vi.spyOn(barDirective, directiveTag);
      const factory = vi.fn((key: 'foo' | 'bar') => {
        switch (key) {
          case 'foo':
            return fooDirective;
          case 'bar':
            return barDirective;
        }
      });
      const value1 = new Choice<'foo' | 'bar', TextDirective>('foo', factory);
      const value2 = new Choice<'foo' | 'bar', TextDirective>('bar', factory);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);
      const binding = new ChoiceBinding(value1, part, context);
      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.binding.value).toBe(barDirective);
      expect(fooDirectiveSpy).toHaveBeenCalledOnce();
      expect(barDirectiveSpy).toHaveBeenCalledOnce();
      expect(factory).toHaveBeenCalledTimes(2);
      expect(factory).toHaveBeenNthCalledWith(1, 'foo');
      expect(factory).toHaveBeenNthCalledWith(2, 'bar');
      expect(bindSpy).not.toHaveBeenCalled();
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });

    it('should memoize the old binding if the key changes', () => {
      const fooDirective = new TextDirective();
      const barDirective = new TextDirective();
      const fooDirectiveSpy = vi.spyOn(fooDirective, directiveTag);
      const barDirectiveSpy = vi.spyOn(barDirective, directiveTag);
      const factory = vi.fn((key: 'foo' | 'bar') => {
        switch (key) {
          case 'foo':
            return fooDirective;
          case 'bar':
            return barDirective;
        }
      });
      const value1 = new Choice<'foo' | 'bar', TextDirective>('foo', factory);
      const value2 = new Choice<'foo' | 'bar', TextDirective>('bar', factory);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);
      const binding = new ChoiceBinding(value1, part, context);
      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      binding.bind(value1, context);
      context.flushUpdate();

      expect(binding.binding.value).toBe(fooDirective);
      expect(fooDirectiveSpy).toHaveBeenCalledOnce();
      expect(barDirectiveSpy).toHaveBeenCalledOnce();
      expect(factory).toHaveBeenCalledTimes(3);
      expect(factory).toHaveBeenNthCalledWith(1, 'foo');
      expect(factory).toHaveBeenNthCalledWith(2, 'bar');
      expect(factory).toHaveBeenNthCalledWith(3, 'foo');
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });

    it('should throw an error if the new value is not Choice directive', () => {
      const value = choice('foo', () => new TextDirective());
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);
      const binding = new ChoiceBinding(value, part, context);

      expect(() => {
        binding.bind(null as any, context);
      }).toThrow(
        'A value must be a instance of Choice directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should delegate to the current binding', () => {
      const value = choice('foo', () => new TextDirective());
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);
      const binding = new ChoiceBinding(value, part, context);
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.unbind(context);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.disconnect()', () => {
    it('should delegate to the current binding', () => {
      const value = choice('foo', () => new TextDirective());
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new UpdateContext(host, updater);
      const binding = new ChoiceBinding(value, part, context);
      const disconnectSpy = vi.spyOn(binding.binding, 'disconnect');

      binding.disconnect();

      expect(disconnectSpy).toHaveBeenCalledOnce();
    });
  });
});
