import { describe, expect, it } from 'vitest';

import {
  $toDirective,
  areDirectiveTypesEqual,
  DirectiveSpecifier,
  PrimitiveDirective,
  SlotSpecifier,
} from '@/directive.js';
import { PartType } from '@/part.js';
import { Runtime } from '@/runtime.js';
import {
  MockDirective,
  MockPrimitive,
  MockRenderHost,
  MockSlot,
} from '../mocks.js';

describe('PrimitiveDirective', () => {
  describe('resolveBinding()', () => {
    it('resolve the directive from the primitive value', () => {
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
      } as const;
      const runtime = new Runtime(new MockRenderHost());
      const binding = PrimitiveDirective.resolveBinding(value, part, runtime);

      expect(binding.type).toBe(MockPrimitive);
      expect(binding.value).toBe(value);
      expect(binding.part).toBe(part);
    });
  });
});

describe('DirectiveSpecifier', () => {
  describe('[$toDirectiveElement]()', () => {
    it('returns itself as a directive element', () => {
      const type = new MockDirective();
      const value = 'foo';
      const bindable = new DirectiveSpecifier(type, value);

      expect(bindable.type).toBe(type);
      expect(bindable.value).toBe(value);
      expect(bindable[$toDirective]()).toBe(bindable);
    });
  });
});

describe('SlotSpecifier', () => {
  describe('[$toDirectiveElement]()', () => {
    it('returns a directive element with the primitive value', () => {
      const slotType = MockSlot;
      const value = 'foo';
      const bindable = new SlotSpecifier(slotType, value);
      const directive = bindable[$toDirective]();

      expect(directive.type).toBe(PrimitiveDirective);
      expect(directive.value).toBe(value);
      expect(directive.slotType).toBe(slotType);
    });

    it('returns a directive element with the bindable value', () => {
      const slotType = MockSlot;
      const value = new DirectiveSpecifier(new MockDirective(), 'foo');
      const bindable = new SlotSpecifier(slotType, value);
      const directive = bindable[$toDirective]();

      expect(directive.type).toBe(value.type);
      expect(directive.value).toBe(value.value);
      expect(directive.slotType).toBe(slotType);
    });
  });
});

describe('areDirectiveTypesEqual', () => {
  it('returns the result from Directive.equals() if it is definied', () => {
    const directiveType1 = new MockDirective();
    const directiveType2 = MockPrimitive;

    expect(areDirectiveTypesEqual(directiveType1, directiveType1)).toBe(true);
    expect(areDirectiveTypesEqual(directiveType1, directiveType2)).toBe(false);
    expect(areDirectiveTypesEqual(directiveType2, directiveType1)).toBe(false);
    expect(areDirectiveTypesEqual(directiveType2, directiveType2)).toBe(true);
  });
});
