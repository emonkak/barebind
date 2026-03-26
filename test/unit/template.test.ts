import { describe, expect, it } from 'vitest';
import { Directive, Template } from '@/core.js';
import { html, math, Partial, svg, text } from '@/template.js';

describe('Partial', () => {
  describe('static html()', () => {
    it('interpolates partials in HTML tagged template', () => {
      const tag = Partial.literal('div');
      const directive = Partial.html`<${tag}>Hello, ${'World'}!</${tag}>`[
        Directive.toDirective
      ]();

      expect(directive.type).toBe(Template);
      expect(directive.value.strings).toStrictEqual([
        '<div>Hello, ',
        '!</div>',
      ]);
      expect(directive.value.exprs).toStrictEqual(['World']);
      expect(directive.value.mode).toBe('html');
    });
  });

  describe('static literal()', () => {
    it('returns a new Partial with the single string and no expressions', () => {
      const template = Partial.literal('div');
      expect(template.strings).toStrictEqual(['div']);
      expect(template.exprs).toStrictEqual([]);
    });
  });

  describe('static math()', () => {
    it('interpolates partials in MathML tagged template', () => {
      const tag = Partial.literal('mi');
      const directive = Partial.math`<${tag}>${'x'}</${tag}>`[
        Directive.toDirective
      ]();

      expect(directive.type).toBe(Template);
      expect(directive.value.strings).toStrictEqual(['<mi>', '</mi>']);
      expect(directive.value.exprs).toStrictEqual(['x']);
      expect(directive.value.mode).toBe('math');
    });
  });

  describe('static parse()', () => {
    it('returns a new Partial from the template literal', () => {
      const template = Partial.parse`Hello, ${'World'}!`;
      expect(template.strings).toStrictEqual(['Hello, ', '!']);
      expect(template.exprs).toStrictEqual(['World']);
      expect(template.toString()).toBe('Hello, World!');
    });

    it('interpolates literals into strings', () => {
      const tag = Partial.literal('div');
      const template = Partial.parse`<${tag}>content</${tag}>`;
      expect(template.strings).toStrictEqual(['<div>content</div>']);
      expect(template.exprs).toStrictEqual([]);
      expect(template.toString()).toBe('<div>content</div>');
    });

    it('interpolates nested partials into strings', () => {
      const greeting = Partial.parse`Hello, ${'World'}!`;
      const template = Partial.parse`<p>${greeting}</p>`;
      expect(template.strings).toStrictEqual(['<p>Hello, ', '!</p>']);
      expect(template.exprs).toStrictEqual(['World']);
      expect(template.toString()).toBe('<p>Hello, World!</p>');
    });

    it('returns the same string for the same string reference', () => {
      const strings = ['Hello, ', '!'];
      const template1 = Partial.parse(strings, 'Alice');
      const template2 = Partial.parse(strings, 'Bob');
      expect(template1.strings).toBe(strings);
      expect(template1.strings).toBe(template2.strings);
      expect(template1.exprs).toStrictEqual(['Alice']);
      expect(template2.exprs).toStrictEqual(['Bob']);
    });

    it('returns different interpolated strings when expressions change', () => {
      const strings = ['<', '>content</', '>'];
      const tag1 = Partial.literal('div');
      const tag2 = Partial.literal('span');
      const template1 = Partial.parse(strings, tag1, tag1);
      const template2 = Partial.parse(strings, tag2, tag2);
      const template3 = Partial.parse(strings, tag2, tag2);
      expect(template1.strings).toStrictEqual(['<div>content</div>']);
      expect(template2.strings).toStrictEqual(['<span>content</span>']);
      expect(template3.strings).toBe(template2.strings);
      expect(template1.exprs).toStrictEqual([]);
      expect(template2.exprs).toStrictEqual([]);
      expect(template3.exprs).toStrictEqual([]);
    });

    it('should handle no expressions', () => {
      const template = Partial.parse`no expressions here`;
      expect(template.strings).toStrictEqual(['no expressions here']);
      expect(template.exprs).toStrictEqual([]);
      expect(template.toString()).toBe('no expressions here');
    });
  });

  describe('static svg()', () => {
    it('interpolates partials in SVG tagged template', () => {
      const tag = Partial.literal('text');
      const directive = Partial.svg`<${tag}>Hello, ${'World'}!</${tag}>`[
        Directive.toDirective
      ]();

      expect(directive.type).toBe(Template);
      expect(directive.value.strings).toStrictEqual([
        '<text>Hello, ',
        '!</text>',
      ]);
      expect(directive.value.exprs).toStrictEqual(['World']);
      expect(directive.value.mode).toBe('svg');
    });
  });

  describe('toString()', () => {
    it('renders literal strings via toString()', () => {
      expect(Partial.literal('span').toString()).toBe('span');
    });
  });
});

describe('html()', () => {
  it('returns Directive with HTML mode', () => {
    const directive = html`<div>Hello, ${'World'}!</div>`;
    expect(directive.type).toBe(Template);
    expect(directive.value.strings).toStrictEqual(['<div>Hello, ', '!</div>']);
    expect(directive.value.exprs).toStrictEqual(['World']);
    expect(directive.value.mode).toStrictEqual('html');
  });
});

describe('math()', () => {
  it('returns Directive with MathML mode', () => {
    const directive = math`<mi>${'x'}</mi>`;
    expect(directive.type).toBe(Template);
    expect(directive.value.strings).toStrictEqual(['<mi>', '</mi>']);
    expect(directive.value.exprs).toStrictEqual(['x']);
    expect(directive.value.mode).toStrictEqual('math');
  });
});

describe('svg()', () => {
  it('returns Directive with SVG mode', () => {
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
  it('returns Directive with Textarea mode', () => {
    const directive = text`<div>Hello, ${'World'}!</div>`;
    expect(directive.type).toBe(Template);
    expect(directive.value.strings).toStrictEqual(['<div>Hello, ', '!</div>']);
    expect(directive.value.exprs).toStrictEqual(['World']);
    expect(directive.value.mode).toStrictEqual('textarea');
  });
});
