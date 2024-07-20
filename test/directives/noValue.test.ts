import { describe, expect, it } from 'vitest';

import {
  NoValue,
  NoValueBinding,
  noValue,
} from '../../src/directives/noValue.js';
import { PartType, directiveTag } from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockUpdateContext } from '../mocks.js';

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
    it('should return a new instance of NoValueBinding', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const updater = new SyncUpdater(new MockUpdateContext());
      const binding = noValue[directiveTag](part, updater);

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
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new NoValueBinding(part);
      const updater = new SyncUpdater(new MockUpdateContext());

      binding.connect(updater);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.bind()', () => {
    it('should do nothing', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new NoValueBinding(part);
      const updater = new SyncUpdater(new MockUpdateContext());

      binding.bind(noValue, updater);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should throw an error if the new value is not NoValue', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new NoValueBinding(part);
      const updater = new SyncUpdater(new MockUpdateContext());

      expect(() => binding.bind(null as any, updater)).toThrow(
        'A value must be a instance of NoValue directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should do nothing', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new NoValueBinding(part);
      const updater = new SyncUpdater(new MockUpdateContext());

      binding.unbind(updater);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new NoValueBinding(part);

      binding.disconnect();
    });
  });
});
