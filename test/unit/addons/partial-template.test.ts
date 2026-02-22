import { describe, expect, it } from 'vitest';

import {
  PartialTemplate,
  PartialTemplateContext,
} from '@/addons/partial-template.js';
import { $directive } from '@/internal.js';
import { MockTemplate } from '../../mocks.js';
import { TestRenderer } from '../../test-renderer.js';

describe('PartialTemplate', () => {
  describe('literal()', () => {
    it('should create a PartialTemplate with a single string and no values', () => {
      const template = PartialTemplate.literal('div');
      expect(template.strings).toStrictEqual(['div']);
      expect(template.values).toStrictEqual([]);
    });

    it('should render the literal string via toString()', () => {
      expect(PartialTemplate.literal('span').toString()).toBe('span');
    });
  });

  describe('parse()', () => {
    it('should create a PartialTemplate from a plain template literal', () => {
      const template = PartialTemplate.parse`Hello, ${'World'}!`;
      expect(template.strings).toStrictEqual(['Hello, ', '!']);
      expect(template.values).toStrictEqual(['World']);
      expect(template.toString()).toBe('Hello, World!');
    });

    it('should interpolate a nested PartialTemplate into strings', () => {
      const tag = PartialTemplate.literal('div');
      const template = PartialTemplate.parse`<${tag}>content</${tag}>`;
      expect(template.strings).toStrictEqual(['<div>content</div>']);
      expect(template.values).toStrictEqual([]);
      expect(template.toString()).toBe('<div>content</div>');
    });

    it('should interpolate a nested PartialTemplate that has values', () => {
      const greeting = PartialTemplate.parse`Hello, ${'World'}!`;
      const template = PartialTemplate.parse`<p>${greeting}</p>`;
      expect(template.strings).toStrictEqual(['<p>Hello, ', '!</p>']);
      expect(template.values).toStrictEqual(['World']);
      expect(template.toString()).toBe('<p>Hello, World!</p>');
    });

    it('should return the same strings from cache for the same strings reference', () => {
      const strings = ['Hello, ', '!'];
      const template1 = PartialTemplate.parse(strings, 'Alice');
      const template2 = PartialTemplate.parse(strings, 'Bob');
      expect(template1.strings).toBe(strings);
      expect(template1.strings).toBe(template2.strings);
      expect(template1.values).toStrictEqual(['Alice']);
      expect(template2.values).toStrictEqual(['Bob']);
    });

    it('should return different interpolated strings when PartialTemplate values change', () => {
      const strings = ['<', '>content</', '>'];
      const tag1 = PartialTemplate.literal('div');
      const tag2 = PartialTemplate.literal('span');
      const template1 = PartialTemplate.parse(strings, tag1, tag1);
      const template2 = PartialTemplate.parse(strings, tag2, tag2);
      expect(template1.strings).toStrictEqual(['<div>content</div>']);
      expect(template2.strings).toStrictEqual(['<span>content</span>']);
      expect(template1.values).toStrictEqual([]);
      expect(template2.values).toStrictEqual([]);
    });

    it('should handle no values', () => {
      const template = PartialTemplate.parse`no values here`;
      expect(template.strings).toStrictEqual(['no values here']);
      expect(template.values).toStrictEqual([]);
      expect(template.toString()).toBe('no values here');
    });
  });
});

describe('PartialTemplateContext', () => {
  it('should preprocess PartialTemplates in HTML tagged template', () => {
    const renderer = new TestRenderer((_props, session) => {
      const { html } = session.use(PartialTemplateContext);
      const tag = PartialTemplate.literal('div');
      return html`<${tag}>Hello, ${'World'}!</${tag}>`[$directive]();
    });

    const directive = renderer.render({});

    expect(directive.type).toBeInstanceOf(MockTemplate);
    expect(directive.type).toStrictEqual(
      expect.objectContaining({
        strings: ['<div>Hello, ', '!</div>'],
        values: ['World'],
        mode: 'html',
      }),
    );
    expect(directive.value).toStrictEqual(['World']);
  });

  it('should preprocess PartialTemplates in SVG tagged template', () => {
    const renderer = new TestRenderer((_props, session) => {
      const { svg } = session.use(PartialTemplateContext);
      const tag = PartialTemplate.literal('text');
      return svg`<${tag}>Hello, ${'World'}!</${tag}>`[$directive]();
    });

    const directive = renderer.render({});

    expect(directive.type).toBeInstanceOf(MockTemplate);
    expect(directive.type).toStrictEqual(
      expect.objectContaining({
        strings: ['<text>Hello, ', '!</text>'],
        values: ['World'],
        mode: 'svg',
      }),
    );
    expect(directive.value).toStrictEqual(['World']);
  });

  it('should preprocess PartialTemplates in MathML tagged template', () => {
    const renderer = new TestRenderer((_props, session) => {
      const { math } = session.use(PartialTemplateContext);
      const tag = PartialTemplate.literal('mi');
      return math`<${tag}>${'x'}</${tag}>`[$directive]();
    });

    const directive = renderer.render({});

    expect(directive.type).toBeInstanceOf(MockTemplate);
    expect(directive.type).toStrictEqual(
      expect.objectContaining({
        strings: ['<mi>', '</mi>'],
        values: ['x'],
        mode: 'math',
      }),
    );
    expect(directive.value).toStrictEqual(['x']);
  });
});
