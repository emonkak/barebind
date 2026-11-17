import { DOMAdapter, DOMRoot, html, Runtime } from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Live property binding', () => {
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

  it('updates properties when the value changes', async () => {
    const render = (value: string) => html`
      <input id="input" $value=${value}>
      <output id="output">${value}</output>
    `;

    await root.render(render('a')).finished;
    const input = container.querySelector<HTMLInputElement>('#input')!;
    const output = container.querySelector<HTMLOutputElement>('#output')!;
    expect(input.value).toBe('a');
    expect(output.value).toBe('a');

    await root.render(render('b')).finished;
    expect(input.value).toBe('b');
    expect(output.value).toBe('b');
  });

  it('overwrites current properties with the value', async () => {
    const render = (value: string) => html`
      <input id="input" $value=${value}>
    `;

    await root.render(render('controlled')).finished;
    const input = container.querySelector<HTMLInputElement>('#input')!;
    input.value = 'user-input';

    await root.render(render('controlled')).finished;
    expect(input.value).toBe('controlled');
  });
});
