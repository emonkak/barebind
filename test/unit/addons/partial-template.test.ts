import { describe, expect, it } from 'vitest';

import { PartialTemplate } from '@/addons/partial-template.js';
import { Directive, Template } from '@/core.js';

describe('PartialTemplate', () => {
  describe('html()', () => {
    it('should preprocess PartialTemplates in HTML tagged template', () => {
      const tag = PartialTemplate.literal('div');
      const directive =
        PartialTemplate.html`<${tag}>Hello, ${'World'}!</${tag}>`[
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

  describe('literal()', () => {
    it('should create a PartialTemplate with a single string and no values', () => {
      const template = PartialTemplate.literal('div');
      expect(template.strings).toStrictEqual(['div']);
      expect(template.exprs).toStrictEqual([]);
    });

    it('should render the literal string via toString()', () => {
      expect(PartialTemplate.literal('span').toString()).toBe('span');
    });
  });

  describe('math()', () => {
    it('should preprocess PartialTemplates in HTML tagged template', () => {
      const tag = PartialTemplate.literal('mi');
      const directive = PartialTemplate.math`<${tag}>${'x'}</${tag}>`[
        Directive.toDirective
      ]();

      expect(directive.type).toBe(Template);
      expect(directive.value.strings).toStrictEqual(['<mi>', '</mi>']);
      expect(directive.value.exprs).toStrictEqual(['x']);
      expect(directive.value.mode).toBe('math');
    });
  });

  describe('parse()', () => {
    it('should create a PartialTemplate from a plain template literal', () => {
      const template = PartialTemplate.parse`Hello, ${'World'}!`;
      expect(template.strings).toStrictEqual(['Hello, ', '!']);
      expect(template.exprs).toStrictEqual(['World']);
      expect(template.toString()).toBe('Hello, World!');
    });

    it('should interpolate a nested PartialTemplate into strings', () => {
      const tag = PartialTemplate.literal('div');
      const template = PartialTemplate.parse`<${tag}>content</${tag}>`;
      expect(template.strings).toStrictEqual(['<div>content</div>']);
      expect(template.exprs).toStrictEqual([]);
      expect(template.toString()).toBe('<div>content</div>');
    });

    it('should interpolate a nested PartialTemplate that has values', () => {
      const greeting = PartialTemplate.parse`Hello, ${'World'}!`;
      const template = PartialTemplate.parse`<p>${greeting}</p>`;
      expect(template.strings).toStrictEqual(['<p>Hello, ', '!</p>']);
      expect(template.exprs).toStrictEqual(['World']);
      expect(template.toString()).toBe('<p>Hello, World!</p>');
    });

    it('should return the same strings from cache for the same strings reference', () => {
      const strings = ['Hello, ', '!'];
      const template1 = PartialTemplate.parse(strings, 'Alice');
      const template2 = PartialTemplate.parse(strings, 'Bob');
      expect(template1.strings).toBe(strings);
      expect(template1.strings).toBe(template2.strings);
      expect(template1.exprs).toStrictEqual(['Alice']);
      expect(template2.exprs).toStrictEqual(['Bob']);
    });

    it('should return different interpolated strings when PartialTemplate values change', () => {
      const strings = ['<', '>content</', '>'];
      const tag1 = PartialTemplate.literal('div');
      const tag2 = PartialTemplate.literal('span');
      const template1 = PartialTemplate.parse(strings, tag1, tag1);
      const template2 = PartialTemplate.parse(strings, tag2, tag2);
      const template3 = PartialTemplate.parse(strings, tag2, tag2);
      expect(template1.strings).toStrictEqual(['<div>content</div>']);
      expect(template2.strings).toStrictEqual(['<span>content</span>']);
      expect(template3.strings).toBe(template2.strings);
      expect(template1.exprs).toStrictEqual([]);
      expect(template2.exprs).toStrictEqual([]);
      expect(template3.exprs).toStrictEqual([]);
    });

    it('should handle no values', () => {
      const template = PartialTemplate.parse`no values here`;
      expect(template.strings).toStrictEqual(['no values here']);
      expect(template.exprs).toStrictEqual([]);
      expect(template.toString()).toBe('no values here');
    });
  });

  describe('svg()', () => {
    it('should preprocess PartialTemplates in HTML tagged template', () => {
      const tag = PartialTemplate.literal('text');
      const directive =
        PartialTemplate.svg`<${tag}>Hello, ${'World'}!</${tag}>`[
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
});
