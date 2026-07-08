import { DOMAdapter, DOMRoot, html, Runtime } from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('texts', () => {
  let container: Element;
  let runtime: Runtime;
  let root: DOMRoot;

  beforeEach(() => {
    container = document.createElement('div');
    runtime = new Runtime(new DOMAdapter());
    root = new DOMRoot(container, runtime);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it.each([null, undefined])('sets %s as an empty string', async (value) => {
    const template = html`
      <div>${value}</div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div></div>');
    expect(collectTexts(container)).toStrictEqual(['']);
  });

  it('sets an object without prototype as an empty string', async () => {
    const template = html`
      <div>${{ __proto__: null }}</div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div></div>');
    expect(collectTexts(container)).toStrictEqual(['']);
  });

  it('binds a value to the text node', async () => {
    const template = html`
      <div>${'a'}</div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div>a</div>');
    expect(collectTexts(container)).toStrictEqual(['a']);
  });

  it('binds a value to the text node after a constant', async () => {
    const template = html`
      <div>a${'b'}</div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div>ab</div>');
    expect(collectTexts(container)).toStrictEqual(['a', 'b']);
  });

  it('binds a value to the text node before a constant', async () => {
    const template = html`
      <div>${'a'}b</div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div>ab</div>');
    expect(collectTexts(container)).toStrictEqual(['a', 'b']);
  });

  it('binds a value to the text hole between constants', async () => {
    const template = html`
      <div>a${'b'}c</div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div>abc</div>');
    expect(collectTexts(container)).toStrictEqual(['a', 'b', 'c']);
  });

  it('binds a value to multiple text nodes', async () => {
    const template = html`
      <div>${'a'}${'b'}</div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div>ab</div>');
    expect(collectTexts(container)).toStrictEqual(['a', 'b']);
  });

  it('binds a value to multiple text nodes with new-lines', async () => {
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

  it('binds a value to multiple text nodes with separators', async () => {
    const template = html`
      <div>
        ${'a'}b${'c'}
      </div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div>abc</div>');
    expect(collectTexts(container)).toStrictEqual(['a', 'b', 'c']);
  });

  it('binds a value to multiple text nodes between constants', async () => {
    const template = html`
      <div>
        a${'b'}c${'d'}e
      </div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div>abcde</div>');
    expect(collectTexts(container)).toStrictEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('updates a text node', async () => {
    const render = (value: string) => html`
      <div>${value}</div>
    `;
    await root.render(render('a')).finished;
    await root.render(render('b')).finished;
    expect(container.innerHTML).toBe('<div>b</div>');
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
