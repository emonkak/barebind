import { describe, expect, it } from 'vitest';

import { formatValue } from '@/debug/value.js';
import { DirectiveSpecifier, LayoutSpecifier } from '@/directive.js';
import { $toDirective, PartType } from '@/internal.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import { MockDirective, MockLayout, MockPrimitive } from '../mocks.js';
import { createRuntime } from '../test-helpers.js';

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

  describe('[$debug]()', () => {
    it('returns a string representation for debugging', () => {
      const type = new MockDirective();
      const value = 'foo';
      const bindable = new DirectiveSpecifier(type, value);

      expect(formatValue(bindable)).toBe('MockDirective("foo")');
    });
  });
});

describe('LayoutSpecifier', () => {
  describe('[$toDirective]()', () => {
    it('returns a directive element with the primitive value', () => {
      const layout = MockLayout;
      const value = 'foo';
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = createRuntime();
      const bindable = new LayoutSpecifier(layout, value);
      const directive = bindable[$toDirective](part, runtime);

      expect(directive.type).toBe(MockPrimitive);
      expect(directive.value).toBe(value);
      expect(directive.layout).toBe(layout);
    });

    it('returns a directive element with the bindable value', () => {
      const layout = MockLayout;
      const value = new DirectiveSpecifier(new MockDirective(), 'foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = createRuntime();
      const bindable = new LayoutSpecifier(layout, value);
      const directive = bindable[$toDirective](part, runtime);

      expect(directive.type).toBe(value.type);
      expect(directive.value).toBe(value.value);
      expect(directive.layout).toBe(layout);
    });
  });

  describe('[$debug]()', () => {
    it('returns a string representation of the value', () => {
      const layout = MockLayout;
      const value = new DirectiveSpecifier(new MockDirective(), 'foo');
      const bindable = new LayoutSpecifier(layout, value);

      expect(formatValue(bindable)).toBe('MockLayout(MockDirective("foo"))');
    });
  });
});
