import { describe, expect, it } from 'vitest';
import { createElementPart } from '@/part.js';
import { BlackholeBinding, BlackholeType } from '@/primitive/blackhole.js';
import { createRuntime } from '../../mocks.js';
import { TestUpdater } from '../../test-updater.js';

describe('BlackholeType', () => {
  describe('resolveBinding()', () => {
    it('constructs a new BlackholeBinding', () => {
      const value = 'foo';
      const part = createElementPart(document.createElement('div'));
      const runtime = createRuntime();
      const binding = BlackholeType.resolveBinding(value, part, runtime);

      expect(binding).toBeInstanceOf(BlackholeBinding);
      expect(binding.type).toBe(BlackholeType);
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
      const part = createElementPart(document.createElement('div'));
      const binding = new BlackholeBinding(value1, part);

      expect(binding.shouldUpdate(value1)).toBe(false);
      expect(binding.shouldUpdate(value2)).toBe(false);
    });
  });

  describe('commit()', () => {
    it('should do nothing', () => {
      const value = 'foo';
      const part = createElementPart(document.createElement('div'));
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
      const part = createElementPart(document.createElement('div'));
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
