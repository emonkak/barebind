import { DOMAdapter, html, Root, Runtime } from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('texts', () => {
  let container: Element;
  let runtime: Runtime;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    runtime = new Runtime(new DOMAdapter());
    root = new Root(container, runtime);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it.each([null, undefined])('binds %s as empty string', async (value) => {
    const template = html`
      <div>${value}</div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div></div>');
    expect(collectTexts(container)).toStrictEqual(['']);
  });

  it('binds a text node', async () => {
    const template = html`
      <div>${'a'}</div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div>a</div>');
    expect(collectTexts(container)).toStrictEqual(['a']);
  });

  it('binds a text node after a constant', async () => {
    const template = html`
      <div>a${'b'}</div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div>ab</div>');
    expect(collectTexts(container)).toStrictEqual(['a', 'b']);
  });

  it('binds a text node before a constant', async () => {
    const template = html`
      <div>${'a'}b</div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div>ab</div>');
    expect(collectTexts(container)).toStrictEqual(['a', 'b']);
  });

  it('binds a text hole between constants', async () => {
    const template = html`
      <div>a${'b'}c</div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div>abc</div>');
    expect(collectTexts(container)).toStrictEqual(['a', 'b', 'c']);
  });

  it('binds multiple text holes', async () => {
    const template = html`
      <div>${'a'}${'b'}</div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div>ab</div>');
    expect(collectTexts(container)).toStrictEqual(['a', 'b']);
  });

  it('binds multiple text nodes with new-lines', async () => {
    const template = html`
      <div>
        ${'a'}
        ${'b'}
      </div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div>ab</div>');
    expect(collectTexts(container)).toStrictEqual(['a', 'b']);
  });

  it('binds multiple text holes with a separator', async () => {
    const template = html`
      <div>${'a'}b${'c'}</div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div>abc</div>');
    expect(collectTexts(container)).toStrictEqual(['a', 'b', 'c']);
  });

  it('binds multiple text nodes between constants', async () => {
    const template = html`
      <div>a${'b'}c${'d'}e</div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div>abcde</div>');
    expect(collectTexts(container)).toStrictEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

function collectTexts(node: Node): string[] {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
  const texts = [];

  while (walker.nextNode() !== null) {
    texts.push((walker.currentNode as Text).data);
  }

  return texts;
}
