import { describe, expect, it } from 'vitest';
import { ChildNodeTemplate } from '@/template/child-node.js';
import { ElementTemplate } from '@/template/element.js';
import { FragmentTemplate } from '@/template/fragment.js';
import { Element, Fragment } from '@/template.js';

describe('Element()', () => {
  it('returns a new DirectiveSpecifier with ElementTemplate', () => {
    const props = { class: 'foo' };
    const children = 'bar';
    const bindable = Element('div', props, children);

    expect(bindable.type).toBeInstanceOf(ElementTemplate);
    expect((bindable.type as ElementTemplate)['_tagName']).toBe('div');
    expect(bindable.value).toStrictEqual([props, children]);
  });
});

describe('Fragment()', () => {
  it('returns a new DirectiveSpecifier with FragmentTemplate', () => {
    const children = ['foo', 'bar', 'baz'];
    const bindable = Fragment(children);

    expect(bindable.type).toBeInstanceOf(FragmentTemplate);
    expect((bindable.type as FragmentTemplate)['_templates']).toStrictEqual([
      new ChildNodeTemplate(),
      new ChildNodeTemplate(),
      new ChildNodeTemplate(),
    ]);
    expect(bindable.value).toStrictEqual(children);
  });
});
