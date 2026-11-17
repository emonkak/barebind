import { DOMAdapter, DOMRoot, html, Runtime } from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Child node binding', () => {
  let runtime: Runtime;
  let container: Element;
  let root: DOMRoot;

  beforeEach(() => {
    runtime = new Runtime(new DOMAdapter());
    container = document.createElement('div');
    root = new DOMRoot(runtime, container);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('binds a value to the child node', async () => {
    const template = html`
      <${'a'}>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<!----><!--a-->');
  });

  it('binds a value to the nested child node', async () => {
    const template = html`
      <div>
        <${'a'}>
      </div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div><!--a--></div>');
  });

  it('binds a value to the child node before a slash', async () => {
    const template = html`
      <${'a'} />
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<!----><!--a-->');
  });
});
