import { describe, expect, it } from 'vitest';
import { generateNodeFrame } from '@/dom/debug.js';
import { createElement } from '../../dom-helpers.js';

describe('generateNodeFrame()', () => {
  it('generates node frames for text nodes', () => {
    const node = document.createTextNode('A');
    // biome-ignore format: keep lines
    expect(generateNodeFrame({ type: 'text', node })).toBe([
      '${...}',
      '^^^^^^',
    ].join('\n'));
  });

  it('generates node frames for text nodes in a tree', () => {
    const node = document.createTextNode('C');
    createElement(
      'div',
      {},
      createElement('div', {}, 'A'),
      createElement('div', {}, 'B', node),
    );
    // biome-ignore format: keep lines
    expect(generateNodeFrame({ type: 'text', node })).toBe([
      '<div>',
      '  <div>',
      '    A',
      '  </div>',
      '  <div>',
      '    B',
      '    ${...}',
      '    ^^^^^^',
      '  </div>',
      '</div>',
    ].join('\n'));
  });

  it('generates node frames for comment nodes', () => {
    const node = document.createComment('A');
    // biome-ignore format: keep lines
    expect(generateNodeFrame({ type: 'comment', node })).toBe([
      '<!--${...}-->',
      '^^^^^^^^^^^^^',
    ].join('\n'));
  });

  it('generates node frames for comments nodes in a tree', () => {
    const node = document.createComment('C');
    createElement(
      'div',
      {},
      createElement('div', {}, 'A'),
      createElement('div', {}, 'B', node),
    );
    // biome-ignore format: keep lines
    expect(generateNodeFrame({ type: 'comment', node })).toBe([
      '<div>',
      '  <div>',
      '    A',
      '  </div>',
      '  <div>',
      '    B',
      '    <!--${...}-->',
      '    ^^^^^^^^^^^^^',
      '  </div>',
      '</div>',
    ].join('\n'));
  });

  it('generates node frames for element tagNames', () => {
    const node = createElement('div', { class: 'a' });
    // biome-ignore format: keep lines
    expect(generateNodeFrame({ type: 'tagName', node })).toBe([
      '<${...} class="a">',
      ' ^^^^^^',
      '</div>',
    ].join('\n'));
  });

  it('generates node frames for element attribute', () => {
    const node = createElement('div', { class: 'a' });
    // biome-ignore format: keep lines
    expect(generateNodeFrame({ type: 'attribute', name: 'id', node })).toBe([
      '<div class="a" id=${...}>',
      '               ^^^^^^^^^',
      '</div>'
    ].join('\n'));
  });

  it('generates node frames for element itself', () => {
    const node = createElement('div', { class: 'a' });
    // biome-ignore format: keep lines
    expect(generateNodeFrame({ type: 'element', node })).toBe([
      '<div class="a" ${...}>',
      '               ^^^^^^',
      '</div>'
    ].join('\n'));
  });

  it('generates node frames for unclosed element tagNames', () => {
    const node = createElement('input');
    // biome-ignore format: keep lines
    expect(generateNodeFrame({ type: 'element', node })).toBe([
      '<input ${...}>',
      '       ^^^^^^',
    ].join('\n'));
  });

  it('generates node frames for unclosed element attribute', () => {
    const node = createElement('input');
    // biome-ignore format: keep lines
    expect(generateNodeFrame({ type: 'attribute', name: 'id', node })).toBe([
      '<input id=${...}>',
      '       ^^^^^^^^^',
    ].join('\n'));
  });

  it('generates node frames for unclosed element itself', () => {
    const node = createElement('input');
    // biome-ignore format: keep lines
    expect(generateNodeFrame({ type: 'element', node })).toBe([
      '<input ${...}>',
      '       ^^^^^^',
    ].join('\n'));
  });
});
