import { DOMAdapter, DOMRoot, html, Runtime } from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('root', () => {
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

  it('preserves pre-existing children on the first render', async () => {
    container.innerHTML = '<div>pre-existing</div>';

    await root.render(html`<div id="app">hello</div>`).finished;
    expect(container.innerHTML).toBe(
      '<div>pre-existing</div><div id="app">hello</div>',
    );
  });

  it('preserves pre-existing children on unmount', async () => {
    container.innerHTML = '<div>pre-existing</div>';

    await root.render(html`<div id="app">hello</div>`).finished;
    await root.unmount().finished;
    expect(container.innerHTML).toBe('<div>pre-existing</div>');
  });

  it('does not re-clear on subsequent renders (preserves reconciled DOM)', async () => {
    const render = (v: string) => html`<div id="first">${v}</div>`;

    await root.render(render('first')).finished;
    const firstEl = container.querySelector<HTMLDivElement>('#first')!;
    expect(firstEl).toBeInstanceOf(HTMLDivElement);
    expect(firstEl.innerHTML).toBe('first');

    await root.render(render('second')).finished;
    expect(container.querySelector('#first')).toBe(firstEl);
    expect(firstEl.innerHTML).toBe('second');
  });

  it('clears the container on unmount', async () => {
    await root.render(html`<div id="app">hello</div>`).finished;
    expect(container.innerHTML).toBe('<div id="app">hello</div>');

    await root.unmount().finished;
    expect(container.innerHTML).toBe('');
  });

  it('allows re-mounting after unmount', async () => {
    await root.render(html`<div id="first">first</div>`).finished;
    expect(container.innerHTML).toBe('<div id="first">first</div>');

    await root.unmount().finished;
    expect(container.innerHTML).toBe('');

    await root.render(html`<div id="second">second</div>`).finished;
    expect(container.innerHTML).toBe('<div id="second">second</div>');
    expect(container.querySelector('#first')).toBe(null);
    expect(container.querySelector('#second')).not.toBe(null);
  });
});
