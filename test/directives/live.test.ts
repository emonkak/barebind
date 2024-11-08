import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext, directiveTag } from '../../src/baseTypes.js';
import { LiveBinding, live } from '../../src/directives/live.js';
import { SyncUpdater } from '../../src/updaters/syncUpdater.js';
import { MockBlock, MockRenderHost } from '../mocks.js';

describe('live()', () => {
  it('should construct a new Live directive', () => {
    const value = 'foo';
    const directive = live(value);

    expect(directive.value).toBe(value);
  });
});

describe('Live', () => {
  describe('[directiveTag]()', () => {
    it('should create a new LiveBinding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = live('foo');
      const part = {
        type: PartType.Property,
        name: 'value',
        node: document.createElement('input'),
      } as const;
      const binding = value[directiveTag](part, context);

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should throw an error if the part does not indicate arbitrary property', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = live('foo');
      const part = {
        type: PartType.Attribute,
        name: 'value',
        node: document.createElement('input'),
      } as const;

      expect(() => value[directiveTag](part, context)).toThrow(
        'Live directive must be used in an arbitrary property,',
      );
    });
  });
});

describe('LiveBinding', () => {
  describe('.connect()', () => {
    it('should do nothing if the update is already scheduled', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = live('foo');
      const part = {
        type: PartType.Property,
        node: document.createElement('input'),
        name: 'value',
      } as const;
      const binding = new LiveBinding(value, part);

      const enqueueMutationEffectSpy = vi.spyOn(
        context,
        'enqueueMutationEffect',
      );

      binding.connect(context);
      binding.connect(context);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.bind()', () => {
    it('should update the property of the element', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = live('foo');
      const value2 = live('bar');
      const part = {
        type: PartType.Property,
        node: document.createElement('input'),
        name: 'value',
      } as const;
      const binding = new LiveBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      expect(binding.value).toBe(value1);
      expect(part.node.value).toBe(value1.value);

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.value).toBe(value2);
      expect(part.node.value).toBe(value2.value);
    });

    it('should not update the binding if the new and live values are the same', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = live('foo');
      const value2 = live('bar');
      const part = {
        type: PartType.Property,
        node: document.createElement('input'),
        name: 'value',
      } as const;
      const binding = new LiveBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      part.node.value = 'bar';
      binding.bind(value2, context);

      expect(binding.value).toBe(value2);
      expect(context.isPending()).toBe(false);

      part.node.value = 'foo';
      binding.bind(value2, context);

      expect(binding.value).toBe(value2);
      expect(context.isPending()).toBe(true);

      context.flushUpdate();

      expect(part.node.value).toBe(value2.value);
    });

    it('should throw the error if the value is not Live directive', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const binding = new LiveBinding(live('foo'), {
        type: PartType.Property,
        node: document.createElement('input'),
        name: 'value',
      });

      expect(() => {
        binding.bind(null as any, context);
      }).toThrow(
        'The value must be a instance of Live directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should cancel mounting', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = live('foo');
      const part = {
        type: PartType.Property,
        node: document.createElement('input'),
        name: 'value',
      } as const;
      const binding = new LiveBinding(value, part);

      binding.connect(context);
      binding.unbind(context);
      context.flushUpdate();

      expect(part.node.className).toBe('');
    });
  });

  describe('.disconnect()', () => {
    it('should cancel mounting', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = live('foo');
      const part = {
        type: PartType.Property,
        node: document.createElement('input'),
        name: 'value',
      } as const;
      const binding = new LiveBinding(value, part);

      binding.connect(context);
      binding.disconnect(context);
      context.flushUpdate();

      expect(part.node.className).toBe('');

      binding.connect(context);
      context.flushUpdate();

      expect(part.node.value).toBe(value.value);
    });
  });
});
