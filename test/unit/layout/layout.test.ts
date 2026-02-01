import { describe, expect, it } from 'vitest';

import { formatValue } from '@/debug/value.js';
import { DirectiveSpecifier } from '@/directive.js';
import { $toDirective, PartType } from '@/internal.js';
import { LayoutSpecifier } from '@/layout/layout.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';
import {
  createRuntime,
  MockDirective,
  MockLayout,
  MockPrimitive,
} from '../../mocks.js';

describe('LayoutSpecifier', () => {
  describe('[$debug]()', () => {
    it('returns a string representation of the value', () => {
      const source = new DirectiveSpecifier(new MockDirective(), 'foo');
      const layout = MockLayout;
      const bindable = new LayoutSpecifier(source, layout);

      expect(formatValue(bindable)).toBe('MockDirective("foo") in MockLayout');
    });
  });

  describe('[$toDirective]()', () => {
    it('returns a directive element with the primitive value', () => {
      const source = 'foo';
      const layout = MockLayout;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = createRuntime();
      const bindable = new LayoutSpecifier(source, layout);
      const directive = bindable[$toDirective](part, runtime);

      expect(directive.type).toBe(MockPrimitive);
      expect(directive.value).toBe(source);
      expect(directive.layout).toBe(layout);
    });

    it('returns a directive element with the bindable value', () => {
      const source = new DirectiveSpecifier(new MockDirective(), 'foo');
      const layout = MockLayout;
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
        anchorNode: null,
        namespaceURI: HTML_NAMESPACE_URI,
      };
      const runtime = createRuntime();
      const bindable = new LayoutSpecifier(source, layout);
      const directive = bindable[$toDirective](part, runtime);

      expect(directive.type).toBe(source.type);
      expect(directive.value).toBe(source.value);
      expect(directive.layout).toBe(layout);
    });
  });
});
