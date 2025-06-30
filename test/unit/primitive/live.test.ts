import { describe, expect, it, vi } from 'vitest';

import { PartType } from '@/part.js';
import { LiveBinding, LivePrimitive } from '@/primitive/live.js';
import { UpdateEngine } from '@/updateEngine.js';
import { MockRenderHost } from '../../mocks.js';

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
      } as const;
      const context = new UpdateEngine(new MockRenderHost());
      const binding = LivePrimitive.resolveBinding(value, part, context);

      expect(binding.directive).toBe(LivePrimitive);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });

    it('should throw the error if the part is not a live part', () => {
      const value = 'foo';
      const part = {
        type: PartType.Element,
        node: document.createElement('textarea'),
      } as const;
      const context = new UpdateEngine(new MockRenderHost());

      expect(() => LivePrimitive.resolveBinding(value, part, context)).toThrow(
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
      } as const;
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
      } as const;
      const binding = new LiveBinding(value, part);
      const context = new UpdateEngine(new MockRenderHost());

      const setValueSpy = vi.spyOn(part.node, 'value', 'set');

      binding.connect(context);
      binding.commit(context);

      expect(setValueSpy).toHaveBeenCalledOnce();
      expect(setValueSpy).toHaveBeenCalledWith(value);

      binding.connect(context);
      binding.commit(context);

      expect(setValueSpy).toHaveBeenCalledOnce();
      expect(setValueSpy).toHaveBeenCalledWith(value);
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
      } as const;
      const binding = new LiveBinding(value, part);
      const context = new UpdateEngine(new MockRenderHost());

      binding.connect(context);
      binding.commit(context);

      binding.disconnect(context);
      binding.rollback(context);

      expect(part.node.value).toBe('');
    });
  });
});
