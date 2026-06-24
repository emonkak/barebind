import { describe, expect, it } from 'vitest';
import type { TemplateMode } from '@/core.js';
import { DOMTemplate } from '@/dom/template.js';

const TEMPLATE_PLACEHOLDER = '__test__';

describe('DOMTemplate', () => {
  describe('parse()', () => {
    it('parses an HTML template', () => {
      const template = html`
        <div>
          ${'Hello'}, ${'World'}!
        </div>
      `;

      expect(template['_template'].innerHTML).toStrictEqual('<div>, !</div>');
      expect(
        template['_template'].content.firstElementChild?.namespaceURI,
      ).toBe('http://www.w3.org/1999/xhtml');
      expect(template['_holes']).toStrictEqual([
        {
          type: 6, // HOLE_TYPE_TEXT
          index: 1,
        },
        {
          type: 6, // HOLE_TYPE_TEXT
          index: 3,
        },
      ]);
    });

    it('parses a MathML template', () => {
      const template = math`
        <mn>${1}</mn>
        <mo>+</mo>
        <mn>${2}</mn>
        <mo>=</mo>
        <mn>${3}</mn>
      `;

      expect(template['_template'].innerHTML).toBe(
        '<mn></mn><mo>+</mo><mn></mn><mo>=</mo><mn></mn>',
      );
      expect(
        template['_template'].content.firstElementChild?.namespaceURI,
      ).toBe('http://www.w3.org/1998/Math/MathML');
      expect(template['_holes']).toStrictEqual([
        {
          type: 6, // HOLE_TYPE_TEXT
          index: 1,
        },
        {
          type: 6, // HOLE_TYPE_TEXT
          index: 5,
        },
        {
          type: 6, // HOLE_TYPE_TEXT
          index: 9,
        },
      ]);
    });

    it('parses an SVG template', () => {
      const template = svg`
        <text x="0" y="0">
          ${'Hello'}, ${'World'}!
        </text>
      `;

      expect(template['_template'].innerHTML).toBe(
        '<text x="0" y="0">, !</text>',
      );
      expect(
        template['_template'].content.firstElementChild?.namespaceURI,
      ).toBe('http://www.w3.org/2000/svg');
      expect(template['_holes']).toStrictEqual([
        {
          type: 6, // HOLE_TYPE_TEXT
          index: 1,
        },
        {
          type: 6, // HOLE_TYPE_TEXT
          index: 3,
        },
      ]);
    });

    it('parses a text template', () => {
      const template = text`
        <div>${'Hello'}, ${'World'}!</div>
      `;
      expect(template['_template'].content.textContent).toBe('<div>, !</div>');
      expect(template['_holes']).toStrictEqual([
        {
          type: 6, // HOLE_TYPE_TEXT
          index: 1,
        },
        {
          type: 6, // HOLE_TYPE_TEXT
          index: 3,
        },
      ]);
    });

    it('throws for an invalid placeholder', () => {
      expect(() => {
        DOMTemplate.parse([], [], 'html', 'INVALID_PLACEHOLDER', document);
      }).toThrow('Placeholders must match pattern /^[0-9a-z_-]+$/');
    });
  });

  describe('render()', () => {
    it('throws for an invalid template', () => {
      const template = new DOMTemplate(document.createElement('template'), [
        {
          type: 2, // HOLE_TYPE_ELEMENT
          index: 0,
        },
      ]);
      expect(() => {
        template.render();
      }).toThrow('There is no node that the hole indicates.');
    });
  });
});

function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): DOMTemplate {
  return parse(strings, values, 'html');
}

function math(
  strings: TemplateStringsArray,
  ...values: unknown[]
): DOMTemplate {
  return parse(strings, values, 'math');
}

function parse(
  strings: TemplateStringsArray,
  values: unknown[],
  mode: TemplateMode,
): DOMTemplate {
  return DOMTemplate.parse(
    strings,
    values,
    mode,
    TEMPLATE_PLACEHOLDER,
    document,
  );
}

function svg(strings: TemplateStringsArray, ...values: unknown[]): DOMTemplate {
  return parse(strings, values, 'svg');
}

function text(
  strings: TemplateStringsArray,
  ...values: unknown[]
): DOMTemplate {
  return parse(strings, values, 'textarea');
}
