import { describe, expect, it } from 'vitest';

import {
  $toDirectiveElement,
  DelegateDirective,
  DirectiveObject,
  SlotObject,
} from '@/directive.js';
import { PartType } from '@/part.js';
import { Runtime } from '@/runtime.js';
import {
  MockDirective,
  MockPrimitive,
  MockRenderHost,
  MockSlot,
} from '../mocks.js';

describe('DelegateDirective', () => {
  describe('resolveBinding()', () => {
    it('delegates directive resolution to the context', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const runtime = new Runtime(new MockRenderHost());
      const binding = DelegateDirective.resolveBinding(value, part, runtime);

      expect(binding.directive).toBe(MockPrimitive);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });
  });
});

describe('DirectiveObject', () => {
  describe('[$toDirectiveElement]()', () => {
    it('returns itself as a directive element', () => {
      const directive = new MockDirective();
      const value = 'foo';
      const bindable = new DirectiveObject(directive, value);

      expect(bindable.directive).toBe(directive);
      expect(bindable.value).toBe(value);
      expect(bindable[$toDirectiveElement]()).toBe(bindable);
    });
  });
});

describe('SlotObject', () => {
  describe('[$toDirectiveElement]()', () => {
    it('returns a directive element with the primitive value', () => {
      const value = 'foo';
      const slotType = MockSlot;
      const bindable = new SlotObject(value, slotType);
      const element = bindable[$toDirectiveElement]();

      expect(element.directive).toBe(DelegateDirective);
      expect(element.value).toBe(value);
      expect(element.slotType).toBe(slotType);
    });

    it('returns a directive element with the bindable value', () => {
      const value = new DirectiveObject(new MockDirective(), 'foo');
      const slotType = MockSlot;
      const bindable = new SlotObject(value, slotType);
      const element = bindable[$toDirectiveElement]();

      expect(element.directive).toBe(value.directive);
      expect(element.value).toBe(value.value);
      expect(element.slotType).toBe(slotType);
    });
  });
});
