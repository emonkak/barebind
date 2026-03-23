import { describe, expect, it } from 'vitest';
import { Template } from '@/core.js';
import { ChildNodeTemplate } from '@/template/child-node.js';
import { ElementTemplate } from '@/template/element.js';
import { FragmentTemplate } from '@/template/fragment.js';
import { Element, Fragment, html, math, svg, text } from '@/template.js';

describe('Element()', () => {
  it('returns a new Directive with ElementTemplate', () => {
    const props = { class: 'foo' };
    const children = 'bar';
    const bindable = Element('div', props, children);

    expect(bindable.type).toBeInstanceOf(ElementTemplate);
    expect((bindable.type as ElementTemplate)['_tagName']).toBe('div');
    expect(bindable.value).toStrictEqual([props, children]);
  });
});

describe('Fragment()', () => {
  it('returns a new Directive with FragmentTemplate', () => {
    const children = ['foo', 'bar', 'baz'];
    const bindable = Fragment(children);

    expect(bindable.type).toBeInstanceOf(FragmentTemplate);
    expect((bindable.type as FragmentTemplate)['_templates']).toStrictEqual([
      ChildNodeTemplate.Default,
      ChildNodeTemplate.Default,
      ChildNodeTemplate.Default,
    ]);
    expect(bindable.value).toStrictEqual(children);
  });
});

describe('html()', () => {
  it('returns Directive.Template with HTML mode', () => {
    const directive = html`<div>Hello, ${'World'}!</div>`;
    expect(directive.type).toBe(Template);
    expect(directive.value.strings).toStrictEqual(['<div>Hello, ', '!</div>']);
    expect(directive.value.exprs).toStrictEqual(['World']);
    expect(directive.value.mode).toStrictEqual('html');
  });
});

describe('math()', () => {
  it('returns Directive.Template with MathML mode', () => {
    const directive = math`<mi>${'x'}</mi>`;
    expect(directive.type).toBe(Template);
    expect(directive.value.strings).toStrictEqual(['<mi>', '</mi>']);
    expect(directive.value.exprs).toStrictEqual(['x']);
    expect(directive.value.mode).toStrictEqual('math');
  });
});

describe('svg()', () => {
  it('returns Directive.Template with SVG mode', () => {
    const directive = svg`<text>Hello, ${'World'}!</text>`;
    expect(directive.type).toBe(Template);
    expect(directive.value.strings).toStrictEqual([
      '<text>Hello, ',
      '!</text>',
    ]);
    expect(directive.value.exprs).toStrictEqual(['World']);
    expect(directive.value.mode).toStrictEqual('svg');
  });
});

describe('text()', () => {
  it('returns Directive.Template with Textarea mode', () => {
    const directive = text`<div>Hello, ${'World'}!</div>`;
    expect(directive.type).toBe(Template);
    expect(directive.value.strings).toStrictEqual(['<div>Hello, ', '!</div>']);
    expect(directive.value.exprs).toStrictEqual(['World']);
    expect(directive.value.mode).toStrictEqual('textarea');
  });
});
