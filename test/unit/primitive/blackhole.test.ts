import { describe, expect, it } from 'vitest';

import { PartType } from '@/internal.js';
import { BlackholeBinding, BlackholePrimitive } from '@/primitive/blackhole.js';
import { createRuntime, TestUpdater } from '../../test-helpers.js';

describe('BlackholePrimitive', () => {
  describe('resolveBinding()', () => {
    it('constructs a new BlackholeBinding', () => {
      const value = 'foo';
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const runtime = createRuntime();
      const binding = BlackholePrimitive.instance.resolveBinding(
        value,
        part,
        runtime,
      );

      expect(binding.type).toBe(BlackholePrimitive.instance);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });
  });
});

describe('BlackholeBinding', () => {
  describe('shouldUpdate()', () => {
    it('always returns false', () => {
      const value1 = 'foo';
      const value2 = 'bar';
      const part = {
        type: PartType.Element,
        node: document.createElement('div'),
      };
      const binding = new BlackholeBinding(value1, part);

      expect(binding.shouldUpdate(value1)).toBe(false);
      expect(binding.shouldUpdate(value2)).toBe(false);
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
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.attach(session);
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
      const updater = new TestUpdater();

      SESSION: {
        updater.startUpdate((session) => {
          binding.detach(session);
          binding.rollback();
        });
      }
    });
  });
});
