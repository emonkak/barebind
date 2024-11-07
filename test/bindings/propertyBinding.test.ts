import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext } from '../../src/baseTypes.js';
import { PropertyBinding } from '../../src/bindings/propertyBinding.js';
import { SyncUpdater } from '../../src/updaters/syncUpdater.js';
import { MockBlock, MockRenderHost, TextDirective } from '../mocks.js';

describe('PropertyBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new PropertyBinding', () => {
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'className',
      } as const;
      const binding = new PropertyBinding('foo', part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.value).toBe('foo');
    });
  });

  describe('.connect()', () => {
    it('should do nothing if the update is already scheduled', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = 'foo';
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'className',
      } as const;
      const binding = new PropertyBinding(value, part);

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

      const value1 = 'foo';
      const value2 = 'bar';
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'className',
      } as const;
      const binding = new PropertyBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      expect(binding.value).toBe(value1);
      expect(part.node.className).toBe(value1);

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.value).toBe(value2);
      expect(part.node.className).toBe(value2);
    });

    it('should not update the binding if the new and old values are the same', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = 'bar';
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'className',
      } as const;
      const binding = new PropertyBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value, context);

      expect(binding.value).toBe(value);
      expect(context.isPending()).toBe(false);
    });

    it('should throw the error if the value is a directive', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const binding = new PropertyBinding('foo', {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'className',
      });

      expect(() => {
        binding.bind(new TextDirective() as any, context);
      }).toThrow('The value must not be a directive,');
    });
  });

  describe('.unbind()', () => {
    it('should cancel mounting', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = 'foo';
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'className',
      } as const;
      const binding = new PropertyBinding(value, part);

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

      const value = 'foo';
      const part = {
        type: PartType.Property,
        node: document.createElement('div'),
        name: 'className',
      } as const;
      const binding = new PropertyBinding(value, part);

      binding.connect(context);
      binding.disconnect(context);
      context.flushUpdate();

      expect(part.node.className).toBe('');

      binding.connect(context);
      context.flushUpdate();

      expect(part.node.className).toBe(value);
    });
  });
});
