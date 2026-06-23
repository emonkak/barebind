import { describe, expect, it } from 'vitest';
import type { TemplateMode } from '@/core.js';
import { DOMBlock, DOMTemplate } from '@/dom/template.js';

const TEMPLATE_PLACEHOLDER = '__test__';

describe('DOMTemplate', () => {
  describe('parse()', () => {
    it('creates an HTML template', () => {
      const template = html`
        <div id="a">hello</div>
      `;

      expect(template.element.innerHTML).toStrictEqual(
        '<div id="a">hello</div>',
      );
      expect(template.element.content.querySelector('#a')?.namespaceURI).toBe(
        'http://www.w3.org/1999/xhtml',
      );
      expect(template.holes).toStrictEqual([]);
      expect(template.mode).toBe('html');
    });

    it('creates a MathML template', () => {
      const template = math`
        <mn id="a">100</mn>
      `;

      expect(template.element.innerHTML).toBe(`<mn id="a">100</mn>`);
      expect(template.element.content.querySelector('#a')?.namespaceURI).toBe(
        'http://www.w3.org/1998/Math/MathML',
      );
      expect(template.holes).toStrictEqual([]);
      expect(template.mode).toBe('math');
    });

    it('creates an SVG template', () => {
      const template = svg`
        <rect id="a" width="100" height="100"></rect>
      `;

      expect(template.element.innerHTML).toBe(
        '<rect id="a" width="100" height="100"></rect>',
      );
      expect(template.element.content.querySelector('#a')?.namespaceURI).toBe(
        'http://www.w3.org/2000/svg',
      );
      expect(template.holes).toStrictEqual([]);
      expect(template.mode).toBe('svg');
    });

    it('creates a text template', () => {
      const template = text`
        <div>hello</div>
      `;
      expect(template.element.content.textContent).toBe('<div>hello</div>');
      expect(template.holes).toStrictEqual([]);
      expect(template.mode).toBe('textarea');
    });

    it('throws for an invalid placeholder', () => {
      expect(() => {
        DOMTemplate.parse([], [], 'html', '@invalid@', document);
      }).toThrow('Placeholders must match pattern /^[0-9a-z_-]+$/');
    });
  });

  describe('render()', () => {
    it('throws for an invalid template', () => {
      const template = new DOMTemplate(
        document.createElement('template'),
        [
          {
            type: 0, // HOLE_TYPE_ATTRIBUTE,
            index: 0,
            name: 'id',
          },
        ],
        'html',
      );
      expect(() => {
        template.render();
      }).toThrow('There is no node that the hole indicates.');
    });
  });
});

describe('DOMBlock', () => {
  it('throws for an empty fragment', () => {
    expect(() => {
      new DOMBlock(document.createDocumentFragment(), []);
    }).toThrow('The DOMBlock must have at least one child node.');
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
