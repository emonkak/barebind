import { DOMAdapter, DOMRoot, html, Runtime } from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('properties', () => {
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

  it('updates properties when the value changes', async () => {
    const render = (value: string) => html`<div .innerHTML=${value}></div>`;

    await root.render(render('<h1>a</h1>')).finished;
    expect(container.innerHTML).toBe('<div><h1>a</h1></div>');

    await root.render(render('<h2>b</h2>')).finished;
    expect(container.innerHTML).toBe('<div><h2>b</h2></div>');
  });

  it('does not update properties when the value is the same', async () => {
    const template = html`<div .innerHTML=${'<span id="content">a</span>'}></div>`;

    await root.render(template).finished;
    const content = container.querySelector('#content')!;
    expect(content.innerHTML).toBe('a');

    await root.render(template).finished;
    expect(container.querySelector('#content')!).toBe(content);
  });
});
