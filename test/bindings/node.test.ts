import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext } from '../../src/baseTypes.js';
import { NodeBinding } from '../../src/bindings/node.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBlock, MockUpdateHost, TextDirective } from '../mocks.js';

describe('NodeBinding', () => {
  describe('.constructor()', () => {
    it('should construct a new NodeBinding', () => {
      const value = 'foo';
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new NodeBinding(value, part);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.value).toBe(value);
    });
  });

  describe('.bind()', () => {
    it('should update the node value', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = 'foo';
      const value2 = 'bar';
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new NodeBinding<string | null>(value1, part);

      binding.connect(context);
      context.flushUpdate();

      expect(binding.value).toBe(value1);
      expect(part.node.nodeValue).toBe(value1);

      binding.bind(value2, context);
      context.flushUpdate();

      expect(binding.value).toBe(value2);
      expect(part.node.nodeValue).toBe(value2);

      binding.bind(null, context);
      context.flushUpdate();
      context.flushUpdate();

      expect(binding.value).toBe(null);
      expect(part.node.nodeValue).toBe('');
    });

    it('should not update the binding if the new and old values are the same', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = 'foo';
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new NodeBinding(value, part);

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
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new NodeBinding('foo', part);

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
        type: PartType.Node,
        node: document.createElement('div'),
      } as const;
      const binding = new NodeBinding('foo', part);

      expect(() => {
        binding.bind(new TextDirective() as any, context);
      }).toThrow('A value must not be a directive,');
    });
  });

  describe('.unbind()', () => {
    it('should set null to the node value', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = 'foo';
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new NodeBinding(value, part);

      binding.connect(context);
      context.flushUpdate();

      expect(binding.value).toBe(value);
      expect(part.node.nodeValue).toBe(value);

      binding.unbind(context);
      context.flushUpdate();

      expect(binding.value).toBe(value);
      expect(part.node.nodeValue).toBe('');
    });

    it('should cancel mounting', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = 'foo';
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new NodeBinding(value, part);

      binding.connect(context);
      binding.unbind(context);
      context.flushUpdate();

      expect(part.node.nodeValue).toBe('');
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
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const binding = new NodeBinding(value, part);

      binding.connect(context);
      binding.disconnect(context);
      context.flushUpdate();

      expect(part.node.nodeValue).toBe('');
    });
  });
});
