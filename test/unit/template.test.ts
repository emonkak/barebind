import { describe, expect, it } from 'vitest';

import { ChildNodeTemplate } from '@/template/child-node.js';
import { ElementTemplate } from '@/template/element.js';
import { FragmentTemplate } from '@/template/fragment.js';
import { createElement, createFragment } from '@/template.js';

describe('Element()', () => {
  it('returns a new Directive with ElementTemplate', () => {
    const props = { class: 'foo' };
    const children = 'bar';
    const bindable = createElement('div', props, children);

    expect(bindable.type).toBeInstanceOf(ElementTemplate);
    expect((bindable.type as ElementTemplate)['_tagName']).toBe('div');
    expect(bindable.value).toStrictEqual([props, children]);
  });
});

describe('Fragment()', () => {
  it('returns a new Directive with FragmentTemplate', () => {
    const children = ['foo', 'bar', 'baz'];
    const bindable = createFragment(children);

    expect(bindable.type).toBeInstanceOf(FragmentTemplate);
    expect((bindable.type as FragmentTemplate)['_templates']).toStrictEqual([
      ChildNodeTemplate.Default,
      ChildNodeTemplate.Default,
      ChildNodeTemplate.Default,
    ]);
    expect(bindable.value).toStrictEqual(children);
  });
});
