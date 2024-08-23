import { describe, expect, it } from 'vitest';

import { PartType, UpdateContext, directiveTag } from '../../src/baseTypes.js';
import {
  NoValue,
  NoValueBinding,
  noValue,
} from '../../src/directives/noValue.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBlock, MockUpdateHost } from '../mocks.js';

describe('noValue', () => {
  it('should be the same as NoValue.instance', () => {
    expect(noValue).toBe(NoValue.instance);
  });
});

describe('NoValue', () => {
  describe('.constructor()', () => {
    it('should be forbidden from being called directly', () => {
      expect(() => new (NoValue as any)()).toThrow(
        'NoValue constructor cannot be called directly.',
      );
    });
  });

  describe('[directiveTag]()', () => {
    it('should create a new NoValueBinding', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = noValue[directiveTag](part, context);

      expect(binding.value).toBe(noValue);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });
  });
});

describe('NoValueBinding', () => {
  describe('.connect()', () => {
    it('should do nothing', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new NoValueBinding(part);

      binding.connect(context);

      expect(context.isPending()).toBe(false);
    });
  });

  describe('.bind()', () => {
    it('should do nothing', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new NoValueBinding(part);

      binding.bind(noValue, context);

      expect(context.isPending()).toBe(false);
    });

    it('should throw an error if the new value is not NoValue', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new NoValueBinding(part);

      expect(() => binding.bind(null as any, context)).toThrow(
        'A value must be a instance of NoValue directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should do nothing', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new NoValueBinding(part);

      binding.unbind(context);

      expect(context.isPending()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const context = new UpdateContext(
        new MockUpdateHost(),
        new SyncUpdater(),
        new MockBlock(),
      );

      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new NoValueBinding(part);

      binding.disconnect(context);

      expect(context.isPending()).toBe(false);
    });
  });
});
