import { describe, expect, it, vi } from 'vitest';

import { PartType, UpdateContext, directiveTag } from '../../src/baseTypes.js';
import { NodeBinding } from '../../src/bindings/node.js';
import { ChainBinding, chain } from '../../src/directives/chain.js';
import { SyncUpdater } from '../../src/updaters/syncUpdater.js';
import {
  MockBlock,
  MockRenderHost,
  TextBinding,
  TextDirective,
} from '../mocks.js';

describe('chain()', () => {
  it('should construct a new Chain directive', () => {
    const first = 'foo';
    const second = new TextDirective('bar');
    const value = chain(first, second);

    expect(value.first).toBe(first);
    expect(value.second).toBe(second);
  });
});

describe('Chain', () => {
  describe('[Symbol.toStringTag]', () => {
    it('should return a string represented itself', () => {
      expect(chain('foo', new TextDirective('bar'))[Symbol.toStringTag]).toBe(
        'Chain("foo", TextDirective)',
      );
    });
  });

  describe('[directiveTag]()', () => {
    it('should create a new ChainBinding', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = chain('foo', new TextDirective('bar'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = value[directiveTag](part, context);

      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.firstBinding).toBeInstanceOf(NodeBinding);
      expect(binding.firstBinding.value).toBe(value.first);
      expect(binding.secondBinding).toBeInstanceOf(TextBinding);
      expect(binding.secondBinding.value).toBe(value.second);
    });
  });
});

describe('ChainBinding', () => {
  describe('.connect()', () => {
    it('should connect the first and second bindings', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = chain('foo', new TextDirective('bar'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ChainBinding(value, part, context);

      const connect1Spy = vi.spyOn(binding.firstBinding, 'connect');
      const connect2Spy = vi.spyOn(binding.secondBinding, 'connect');

      binding.connect(context);
      context.flushUpdate();

      expect(connect1Spy).toHaveBeenCalledOnce();
      expect(connect1Spy).toHaveBeenCalledWith(context);
      expect(connect2Spy).toHaveBeenCalledOnce();
      expect(connect2Spy).toHaveBeenCalledWith(context);
    });
  });

  describe('.bind()', () => {
    it('should bind the values to the first and second bindings', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value1 = chain('foo', new TextDirective('bar'));
      const value2 = chain('bar', new TextDirective('baz'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ChainBinding(value1, part, context);

      const bind1Spy = vi.spyOn(binding.firstBinding, 'bind');
      const bind2Spy = vi.spyOn(binding.secondBinding, 'bind');

      binding.connect(context);
      context.flushUpdate();

      binding.bind(value2, context);
      context.flushUpdate();

      expect(bind1Spy).toHaveBeenCalledOnce();
      expect(bind1Spy).toHaveBeenCalledWith(value2.first, context);
      expect(bind2Spy).toHaveBeenCalledOnce();
      expect(bind2Spy).toHaveBeenCalledWith(value2.second, context);
    });

    it('should throw an error if the new value is not Chain directive', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = chain('foo', new TextDirective('bar'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ChainBinding(value, part, context);

      expect(() => {
        binding.bind(null as any, context);
      }).toThrow(
        'The value must be a instance of Chain directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should unbind the first and second bindings', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = chain('foo', new TextDirective('bar'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ChainBinding(value, part, context);

      const unbind1Spy = vi.spyOn(binding.firstBinding, 'unbind');
      const unbind2Spy = vi.spyOn(binding.secondBinding, 'unbind');

      binding.unbind(context);

      expect(unbind1Spy).toHaveBeenCalledOnce();
      expect(unbind1Spy).toHaveBeenCalledWith(context);
      expect(unbind2Spy).toHaveBeenCalledOnce();
      expect(unbind2Spy).toHaveBeenCalledWith(context);
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect the first and second bindings', () => {
      const context = new UpdateContext(
        new MockRenderHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const value = chain('foo', new TextDirective('bar'));
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new ChainBinding(value, part, context);

      const disconnect1Spy = vi.spyOn(binding.firstBinding, 'disconnect');
      const disconnect2Spy = vi.spyOn(binding.secondBinding, 'disconnect');

      binding.disconnect(context);

      expect(disconnect1Spy).toHaveBeenCalledOnce();
      expect(disconnect1Spy).toHaveBeenCalledWith(context);
      expect(disconnect2Spy).toHaveBeenCalledOnce();
      expect(disconnect2Spy).toHaveBeenCalledWith(context);
    });
  });
});
