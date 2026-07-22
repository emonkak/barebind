import { bench, describe } from 'vitest';
import type { TemplateMode } from '@/base.js';
import { DOMTemplate } from '@/dom/template.js';

interface TemplateImpl {
  parse(
    strings: readonly string[],
    values: readonly unknown[],
    mode: TemplateMode,
    placeholder: string,
    document: Document,
  ): Template;
}

interface Template {
  render(): void;
}

const parseSmallSparseTemplate = html`
  <ul>
    <li><div><span>A</span></div></li>
    <li><div><span>${'B'}</span></div></li>
    <li><div><span>C</span></div></li>
    <li><div><span>${'D'}</span></div></li>
    <li><div><span>E</span></div></li>
  </ul>
`;
const parseLargeSparseTemplate = html`
  <ul>
    <li><div><span>A</span></div></li>
    <li><div><span>B</span></div></li>
    <li><div><span>C</span></div></li>
    <li><div><span>${'D'}</span></div></li>
    <li><div><span>E</span></div></li>
    <li><div><span>F</span></div></li>
    <li><div><span>G</span></div></li>
    <li><div><span>H</span></div></li>
    <li><div><span>I</span></div></li>
    <li><div><span>J</span></div></li>
    <li><div><span>K</span></div></li>
    <li><div><span>L</span></div></li>
    <li><div><span>M</span></div></li>
    <li><div><span>N</span></div></li>
    <li><div><span>O</span></div></li>
    <li><div><span>P</span></div></li>
    <li><div><span>Q</span></div></li>
    <li><div><span>R</span></div></li>
    <li><div><span>S</span></div></li>
    <li><div><span>T</span></div></li>
    <li><div><span>U</span></div></li>
    <li><div><span>V</span></div></li>
    <li><div><span>${'W'}</span></div></li>
    <li><div><span>X</span></div></li>
    <li><div><span>Y</span></div></li>
    <li><div><span>Z</span></div></li>
  </ul>
`;

describe('parse SMALL sparse templates', () => {
  bench('DOMTemplate', () => {
    parseSmallSparseTemplate(DOMTemplate);
  });
});

describe('parse LARGE sparse templates', () => {
  bench('DOMTemplate', () => {
    parseLargeSparseTemplate(DOMTemplate);
  });
});

describe('render SMALL sparse templates', () => {
  const template = parseSmallSparseTemplate(DOMTemplate);

  bench('DOMTemplate', () => {
    template.render();
  });
});

describe('render LARGE sparse templates', () => {
  const template = parseLargeSparseTemplate(DOMTemplate);

  bench('DOMTemplate', () => {
    template.render();
  });
});

function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): (templateImpl: TemplateImpl) => Template {
  return (templateImpl) =>
    templateImpl.parse(strings, values, 'html', '__bench__', document);
}
