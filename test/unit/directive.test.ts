import { describe, expect, it } from 'vitest';
import { inspectValue } from '@/debug.js';
import {
  $toDirective,
  areDirectiveTypesEqual,
  DirectiveSpecifier,
  SlotSpecifier,
} from '@/directive.js';
import { PartType } from '@/part.js';
import { Runtime } from '@/runtime.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import {
  MockDirective,
  MockHostEnvironment,
  MockPrimitive,
  MockSlot,
} from '../mocks.js';

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

  describe('[$inspect]()', () => {
    it('returns a string representation for debugging', () => {
      const type = new MockDirective();
      const value = 'foo';
      const bindable = new DirectiveSpecifier(type, value);

      expect(inspectValue(bindable)).toBe('MockDirective("foo")');
    });
  });
});

describe('SlotSpecifier', () => {
  describe('[$toDirectiveElement]()', () => {
    it('returns a directive element with the primitive value', () => {
      const slotType = MockSlot;
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = new Runtime(new MockHostEnvironment());
      const bindable = new SlotSpecifier(slotType, value);
      const directive = bindable[$toDirective](part, runtime);

      expect(directive.type).toBe(MockPrimitive);
      expect(directive.value).toBe(value);
      expect(directive.slotType).toBe(slotType);
    });

    it('returns a directive element with the bindable value', () => {
      const slotType = MockSlot;
      const value = new DirectiveSpecifier(new MockDirective(), 'foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        childNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = new Runtime(new MockHostEnvironment());
      const bindable = new SlotSpecifier(slotType, value);
      const directive = bindable[$toDirective](part, runtime);

      expect(directive.type).toBe(value.type);
      expect(directive.value).toBe(value.value);
      expect(directive.slotType).toBe(slotType);
    });
  });

  describe('[$inspect]()', () => {
    it('returns a string representation of the value', () => {
      const slotType = MockSlot;
      const value = new DirectiveSpecifier(new MockDirective(), 'foo');
      const bindable = new SlotSpecifier(slotType, value);

      expect(inspectValue(bindable)).toBe('MockSlot(MockDirective("foo"))');
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
