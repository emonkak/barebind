import { describe, expect, it } from 'vitest';

import { PartType } from '@/internal.js';
import { BlackholeBinding, BlackholePrimitive } from '@/primitive/blackhole.js';
import { createRuntime, UpdateHelper } from '../../test-helpers.js';

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
      };
      const context = createRuntime();
      const binding = BlackholePrimitive.resolveBinding(value, part, context);

      expect(binding.type).toBe(BlackholePrimitive);
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
      };
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
      };
      const binding = new BlackholeBinding(value, part);
      const helper = new UpdateHelper();

      SESSION: {
        helper.startSession((context) => {
          binding.connect(context);
          binding.commit();
        });
      }
    });
  });

  describe('rollback()', () => {
    it('should do nothing', () => {
      const value = 'foo';
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const binding = new BlackholeBinding(value, part);
      const helper = new UpdateHelper();

      SESSION: {
        helper.startSession((context) => {
          binding.disconnect(context);
          binding.rollback();
        });
      }
    });
  });
});
