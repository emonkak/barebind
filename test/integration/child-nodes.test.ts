import { DOMAdapter, DOMRoot, html, Runtime } from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('child nodes', () => {
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
