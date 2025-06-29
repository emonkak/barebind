import { describe, expect, it } from 'vitest';

import { PartType } from '../../src/part.js';
import {
  BlackholeBinding,
  BlackholePrimitive,
} from '../../src/primitive/blackhole.js';
import { UpdateEngine } from '../../src/updateEngine.js';
import { MockRenderHost } from '../mocks.js';

describe('BlackholePrimitive', () => {
  describe('name', () => {
    it('is a string that represents the primitive itself', () => {
      expect(BlackholePrimitive.name, 'BlackholePrimitive');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new BlackholeBinding', () => {
      const value = 'foo';
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const context = new UpdateEngine(new MockRenderHost());
      const binding = BlackholePrimitive.resolveBinding(value, part, context);

      expect(binding.directive).toBe(BlackholePrimitive);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });
  });
});

describe('BlackholeBinding', () => {
  describe('shouldBind()', () => {
    it('always returns false', () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const binding = new BlackholeBinding(value1, part);

      expect(binding.shouldBind(value1)).toBe(false);
      expect(binding.shouldBind(value2)).toBe(false);
    });
  });

  describe('commit()', () => {
    it('should do nothing', () => {
      const value = 'foo';
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const binding = new BlackholeBinding(value, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit(context);
    });
  });

  describe('rollback()', () => {
    it('should do nothing', () => {
      const value = 'foo';
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      } as const;
      const binding = new BlackholeBinding(value, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.disconnect(context);
      binding.rollback(context);
    });
  });
});
