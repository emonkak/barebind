import { describe, expect, it } from 'vitest';
import type { TemplateMode } from '@/base.js';
import { DOMTemplate } from '@/dom/template.js';

const TEMPLATE_TOKEN = '__test__';

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
          path: [0, 0],
        },
        {
          type: 6, // HOLE_TYPE_TEXT
          path: [0, 2],
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
          path: [0, 0],
        },
        {
          type: 6, // HOLE_TYPE_TEXT
          path: [2, 0],
        },
        {
          type: 6, // HOLE_TYPE_TEXT
          path: [4, 0],
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
          path: [0, 0],
        },
        {
          type: 6, // HOLE_TYPE_TEXT
          path: [0, 2],
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
          path: [1],
        },
        {
          type: 6, // HOLE_TYPE_TEXT
          path: [3],
        },
      ]);
    });

    it('throws for an invalid token', () => {
      expect(() => {
        DOMTemplate.parse([], [], 'html', 'INVALID_TOKEN', document);
      }).toThrow('Tokens must match pattern /^[0-9a-z_-]+$/');
    });
  });

  describe('render()', () => {
    it('climbs up from a nested hole to reach a top-level sibling', () => {
      const element = document.createElement('template');
      element.innerHTML = '<ul><li><span></span></li></ul><p></p>';
      const template = new DOMTemplate(element, [
        {
          type: 2, // HOLE_TYPE_ELEMENT
          path: [0, 0, 0], // span inside li inside ul
        },
        {
          type: 2,
          path: [1], // p at top level
        },
      ]);
      const block = template.render();
      expect(block.parts).toHaveLength(2);
    });

    it('throws when a hole path points to a non-existent node', () => {
      const template = new DOMTemplate(document.createElement('template'), [
        {
          type: 2, // HOLE_TYPE_ELEMENT
          path: [0],
        },
      ]);
      expect(() => {
        template.render();
      }).toThrow('There is no node that the hole indicates.');
    });

    it('throws when a sibling at the same level is missing', () => {
      const element = document.createElement('template');
      element.innerHTML = '<div><span></span></div>';
      const template = new DOMTemplate(element, [
        {
          type: 2, // HOLE_TYPE_ELEMENT
          path: [0, 0], // span
        },
        {
          type: 2, // HOLE_TYPE_ELEMENT
          path: [0, 1], // missing second child
        },
      ]);
      expect(() => {
        template.render();
      }).toThrow('There is no node that the hole indicates.');
    });

    it('throws when a sibling is missing during descent', () => {
      const element = document.createElement('template');
      element.innerHTML = '<div><span></span></div>';
      const template = new DOMTemplate(element, [
        {
          type: 2, // HOLE_TYPE_ELEMENT
          path: [0, 1], // second child, but only one exists
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
  return DOMTemplate.parse(strings, values, mode, TEMPLATE_TOKEN, document);
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
