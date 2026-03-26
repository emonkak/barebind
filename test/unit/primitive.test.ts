import { describe, expect, it } from 'vitest';
import { Blackhole, BlackholeBinding } from '@/primitive.js';
import { createMockRuntime } from '../mocks.js';
import { SessionLauncher } from '../session-launcher.js';

describe('Blackhole', () => {
  describe('resolveBinding()', () => {
    it('constructs a new binding with Blackhole type', () => {
      const value = 'foo';
      const part = {};
      const runtime = createMockRuntime();
      const binding = Blackhole.resolveBinding(value, part, runtime);

      expect(binding.type).toBe(Blackhole);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });
  });
});

describe('BlackholeBinding', () => {
  const launcher = new SessionLauncher(createMockRuntime());

  describe('shouldUpdate()', () => {
    it('always returns false', () => {
      const binding = new BlackholeBinding('a', null);

      expect(binding.shouldUpdate('a')).toBe(false);
      expect(binding.shouldUpdate('b')).toBe(false);
    });
  });

  describe('commit()', () => {
    it('does nothing', () => {
      const binding = new BlackholeBinding('foo', {});

      launcher.launchSession((session) => {
        binding.attach(session);
        binding.commit();
      });
    });
  });

  describe('rollback()', () => {
    it('does nothing', () => {
      const binding = new BlackholeBinding('foo', {});

      launcher.launchSession((session) => {
        binding.detach(session);
        binding.rollback();
      });
    });
  });
});
