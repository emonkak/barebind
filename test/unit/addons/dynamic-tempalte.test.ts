import { describe, expect, it } from 'vitest';

import {
  DynamicTemplate,
  Literal,
  preprocessTemplate,
} from '@/addons/dynamic-template.js';
import type { Directive } from '@/internal.js';
import { MockTemplate } from '../../mocks.js';
import { templateLiteral } from '../../test-helpers.js';
import { TestRenderer } from '../../test-renderer.js';

describe('DynamicTemplate', () => {
  it('render a HTML template', () => {
    const renderer = new TestRenderer((_props, session) => {
      const { html, literal } = session.use(DynamicTemplate());
      return html`<${literal('div')}>Hello, ${'World'}!</${literal('div')}>` as unknown as Directive<any>;
    });

    const directive = renderer.render({});

    expect(directive.type).toBeInstanceOf(MockTemplate);
    expect(directive.type).toStrictEqual(
      expect.objectContaining({
        strings: ['<div>Hello, ', '!</div>'],
        binds: ['World'],
        mode: 'html',
      }),
    );
    expect(directive.value).toStrictEqual(['World']);
  });

  it('render a SVG template', () => {
    const renderer = new TestRenderer((_props, session) => {
      const { svg, literal } = session.use(DynamicTemplate());
      return svg`<${literal('text')}>Hello, ${'World'}!</${literal('text')}>` as unknown as Directive<any>;
    });

    const directive = renderer.render({});

    expect(directive.type).toBeInstanceOf(MockTemplate);
    expect(directive.type).toStrictEqual(
      expect.objectContaining({
        strings: ['<text>Hello, ', '!</text>'],
        binds: ['World'],
        mode: 'svg',
      }),
    );
    expect(directive.value).toStrictEqual(['World']);
  });

  it('render a MathML template', () => {
    const renderer = new TestRenderer((_props, session) => {
      const { math, literal } = session.use(DynamicTemplate());
      return math`<${literal('mi')}>${'x'}</${literal('mi')}>` as unknown as Directive<any>;
    });

    const directive = renderer.render({});

    expect(directive.type).toBeInstanceOf(MockTemplate);
    expect(directive.type).toStrictEqual(
      expect.objectContaining({
        strings: ['<mi>', '</mi>'],
        binds: ['x'],
        mode: 'math',
      }),
    );
    expect(directive.value).toStrictEqual(['x']);
  });
});

describe('preprocessTemplate()', () => {
  const createDate = (year: String, month: String, day: String) =>
    templateLiteral`${year}-${month}-${day}`;

  const createElement = (type: String, children: String) =>
    templateLiteral`<${type}>${children}</${type}>`;

  it('returns the same strings as the argument if there are no literals', () => {
    const [strings1, ...values1] = createElement('div', 'foo');
    const [strings2, ...values2] = preprocessTemplate(strings1, values1);

    expect(strings2).toStrictEqual(['<', '>', '</', '>']);
    expect(strings2).toBe(strings1);
    expect(values2).toStrictEqual(['div', 'foo', 'div']);
    expect(preprocessTemplate(strings1, values1)[0]).toBe(strings1);
  });

  it('returns the same strings as previous one if static strings is the same', () => {
    const [strings1, ...values1] = createElement(new Literal('div'), 'foo');
    const [strings2, ...values2] = createElement(new Literal('div'), 'bar');
    const [strings3, ...values3] = preprocessTemplate(strings1, values1);
    const [strings4, ...values4] = preprocessTemplate(strings2, values2);

    expect(strings3).toStrictEqual(['<div>', '</div>']);
    expect(strings4).toStrictEqual(strings3);
    expect(values3).toStrictEqual(['foo']);
    expect(values4).toStrictEqual(['bar']);
    expect(preprocessTemplate(strings1, values1)[0]).toBe(strings3);
    expect(preprocessTemplate(strings2, values2)[0]).toBe(strings4);
  });

  it('returns a new strings if the literal changes', () => {
    const [strings1, ...values1] = createElement(new Literal('div'), 'foo');
    const [strings2, ...values2] = createElement(new Literal('span'), 'bar');
    const [strings3, ...values3] = preprocessTemplate(strings1, values1);
    const [strings4, ...values4] = preprocessTemplate(strings2, values2);

    expect(strings3).toStrictEqual(['<div>', '</div>']);
    expect(strings4).toStrictEqual(['<span>', '</span>']);
    expect(values3).toStrictEqual(['foo']);
    expect(values4).toStrictEqual(['bar']);
    expect(preprocessTemplate(strings1, values1)[0]).toBe(strings3);
    expect(preprocessTemplate(strings2, values2)[0]).toBe(strings4);
  });

  it('returns a new strings if the literal position changes', () => {
    const [strings1, ...values1] = createDate(
      new Literal('1970'),
      new Literal('01'),
      '01',
    );
    const [strings2, ...values2] = createDate(
      new Literal('1970'),
      '01',
      new Literal('01'),
    );
    const [strings3, ...values3] = preprocessTemplate(strings1, values1);
    const [strings4, ...values4] = preprocessTemplate(strings2, values2);

    expect(strings3).toStrictEqual(['1970-01-', '']);
    expect(strings4).toStrictEqual(['1970-', '-01']);
    expect(values3).toStrictEqual(['01']);
    expect(values4).toStrictEqual(['01']);
    expect(preprocessTemplate(strings1, values1)[0]).toBe(strings3);
    expect(preprocessTemplate(strings2, values2)[0]).toBe(strings4);
  });

  it('returns a new strings if the template changes', () => {
    const [strings1, ...values1] =
      templateLiteral`<div>Hello, ${'World'}!</div>`;
    const [strings2, ...values2] =
      templateLiteral`<div>Hello, ${'World'}!</div>`;
    const [strings3, ...values3] = preprocessTemplate(strings1, values1);
    const [strings4, ...values4] = preprocessTemplate(strings2, values2);

    expect(strings3).toStrictEqual(['<div>Hello, ', '!</div>']);
    expect(strings3).toBe(strings1);
    expect(strings3).not.toBe(strings4);
    expect(strings4).toStrictEqual(['<div>Hello, ', '!</div>']);
    expect(strings4).toBe(strings2);
    expect(values3).toStrictEqual(['World']);
    expect(values4).toStrictEqual(['World']);
    expect(preprocessTemplate(strings1, values1)[0]).toBe(strings1);
    expect(preprocessTemplate(strings2, values2)[0]).toBe(strings2);
  });
});
