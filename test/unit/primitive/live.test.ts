import { describe, expect, it, vi } from 'vitest';

import { PartType } from '@/internal.js';
import { LiveBinding, LivePrimitive } from '@/primitive/live.js';
import { createUpdateSession } from '../../session-utils.js';

describe('LivePrimitive', () => {
  describe('name', () => {
    it('is a string that represents the primitive itself', () => {
      expect(LivePrimitive.name, 'LivePrimitive');
    });
  });

  describe('resolveBinding()', () => {
    it('constructs a new LiveBinding', () => {
      const value = 'foo';
      const part = {
        type: PartType.Live,
        node: document.createElement('textarea'),
        name: 'value',
        defaultValue: '',
      };
      const session = createUpdateSession();
      const binding = LivePrimitive.resolveBinding(value, part, session);

      expect(binding.type).toBe(LivePrimitive);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not a live part', () => {
      const value = 'foo';
      const part = {
        type: PartType.Element,
        node: document.createElement('textarea'),
      };
      const session = createUpdateSession();

      expect(() => LivePrimitive.resolveBinding(value, part, session)).toThrow(
        'LivePrimitive must be used in a live part,',
      );
    });
  });
});

describe('LiveBinding', () => {
  describe('shouldBind()', () => {
    it('returns always true', () => {
      const value = 'foo';
      const part = {
        type: PartType.Live,
        node: document.createElement('textarea'),
        name: 'value',
        defaultValue: '',
      };
      const binding = new LiveBinding(value, part);

      expect(binding.shouldBind(value)).toBe(true);
    });
  });

  describe('commit()', () => {
    it('sets the value for the property if it is different from the current one', () => {
      const value = 'foo';
      const part = {
        type: PartType.Live,
        node: document.createElement('textarea'),
        name: 'value',
        defaultValue: '',
      };
      const binding = new LiveBinding(value, part);
      const session = createUpdateSession();

      const setValueSpy = vi.spyOn(part.node, 'value', 'set');

      SESSION1: {
        binding.connect(session);
        binding.commit(session);

        expect(setValueSpy).toHaveBeenCalledOnce();
        expect(setValueSpy).toHaveBeenCalledWith(value);
      }

      SESSION2: {
        binding.connect(session);
        binding.commit(session);

        expect(setValueSpy).toHaveBeenCalledOnce();
        expect(setValueSpy).toHaveBeenCalledWith(value);
      }
    });
  });

  describe('rollback()', () => {
    it('restores the property to the initial value of the part', () => {
      const value = 'foo';
      const part = {
        type: PartType.Live,
        node: document.createElement('textarea'),
        name: 'value',
        defaultValue: '',
      };
      const binding = new LiveBinding(value, part);
      const session = createUpdateSession();

      SESSION1: {
        binding.connect(session);
        binding.commit(session);

        expect(part.node.value).toBe(value);
      }

      SESSION2: {
        binding.disconnect(session);
        binding.rollback(session);

        expect(part.node.value).toBe('');
      }
    });
  });
});
