import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext } from '../../src/baseTypes.js';
import { AttributeBinding } from '../../src/bindings/attribute.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBlock, MockUpdateHost, TextDirective } from '../mocks.js';

describe('AttributeBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new AttributeBinding', () => {
      const value = 'foo';
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      } as const;
      const binding = new AttributeBinding(value, part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.value).toBe(value);
    });
  });

  describe('.bind()', () => {
    it('should update the attribute with the passed string', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = 'foo';
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      } as const;
      const binding = new AttributeBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      expect(binding.value).toBe(value);
      expect(part.node.getAttribute('class')).toBe(value);

      binding.bind(value, context);
      context.flushUpdate();

      expect(binding.value).toBe(value);
      expect(part.node.getAttribute('class')).toBe(value);
    });

    it('should update the attribute with the string representation of the object', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = {
        toString() {
          return 'foo';
        },
      };
      const value2 = {
        toString() {
          return 'bar';
        },
      };
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      } as const;
      const binding = new AttributeBinding(value1, part);

      binding.connect(context);
      context.flushUpdate();

      expect(binding.value).toBe(value1);
      expect(part.node.getAttribute('class')).toBe('foo');

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.value).toBe(value2);
      expect(part.node.getAttribute('class')).toBe('bar');
    });

    it('should toggle the attribute according to the boolean value', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'contenteditable',
      } as const;
      const binding = new AttributeBinding(true, part);

      binding.connect(context);
      context.flushUpdate();

      expect(binding.value).toBe(true);
      expect(part.node.hasAttribute('contenteditable')).toBe(true);

      binding.bind(false, context);
      context.flushUpdate();

      expect(binding.value).toBe(false);
      expect(part.node.hasAttribute('contenteditable')).toBe(false);
    });

    it.each([[null], [undefined]])(
      'should remove the attribute when null or undefined is passed',
      (value) => {
        const context = new UpdateContext(
          new MockUpdateHost(),
          new SyncUpdater(),
          new MockBlock(),
        );

        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: 'contenteditable',
        } as const;
        const binding = new AttributeBinding(value, part);

        part.node.toggleAttribute('contenteditable', true);
        binding.connect(context);
        context.flushUpdate();

        expect(binding.value).toBe(value);
        expect(part.node.hasAttribute('contenteditable')).toBe(false);
      },
    );

    it('should remove the attribute when undefined is passed', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'contenteditable',
      } as const;
      const binding = new AttributeBinding(undefined, part);

      part.node.toggleAttribute('contenteditable', true);
      binding.connect(context);
      context.flushUpdate();

      expect(binding.value).toBe(undefined);
      expect(part.node.hasAttribute('contenteditable')).toBe(false);
    });

    it('should not update the binding if the new and old values are the same', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = 'foo';
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      } as const;
      const binding = new AttributeBinding('foo', part);

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value, context);

      expect(binding.value).toBe(value);
      expect(context.isPending()).toBe(false);
    });

    it('should do nothing if the update is already scheduled', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'contenteditable',
      } as const;
      const binding = new AttributeBinding(undefined, part);

      const enqueueMutationEffectSpy = vi.spyOn(
        context,
        'enqueueMutationEffect',
      );

      binding.connect(context);
      binding.connect(context);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });

    it('should throw the error if the value is a directive', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      } as const;
      const binding = new AttributeBinding(null, part);

      expect(() => {
        binding.bind(new TextDirective() as any, context);
      }).toThrow('A value must not be a directive,');
    });
  });

  describe('.unbind()', () => {
    it('should remove the attribute', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'contenteditable',
      } as const;
      const binding = new AttributeBinding(true, part);

      binding.connect(context);
      context.flushUpdate();

      binding.unbind(context);
      context.flushUpdate();

      expect(binding.value).toBe(true);
      expect(part.node.hasAttribute('contenteditable')).toBe(false);
    });

    it.each([[null], [undefined]])(
      'should do nothing if the value is null or undefined',
      (value) => {
        const context = new UpdateContext(
          new MockUpdateHost(),
          new SyncUpdater(),
          new MockBlock(),
        );

        const part = {
          type: PartType.Attribute,
          node: document.createElement('div'),
          name: 'contenteditable',
        } as const;
        const binding = new AttributeBinding(value, part);

        binding.unbind(context);

        expect(binding.value).toBe(value);
        expect(context.isPending()).toBe(false);
      },
    );

    it('should cancel mounting', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = 'foo';
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      } as const;
      const binding = new AttributeBinding(value, part);

      binding.connect(context);
      binding.unbind(context);
      context.flushUpdate();

      expect(part.node.getAttribute('class')).toBe(null);
    });
  });

  describe('.disconnect()', () => {
    it('should cancel mounting', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = 'foo';
      const part = {
        type: PartType.Attribute,
        node: document.createElement('div'),
        name: 'class',
      } as const;
      const binding = new AttributeBinding(value, part);

      binding.connect(context);
      binding.disconnect(context);
      context.flushUpdate();

      expect(part.node.getAttribute('class')).toBe(null);
    });
  });
});
