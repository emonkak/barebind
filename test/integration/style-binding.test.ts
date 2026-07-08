import { DOMAdapter, DOMRoot, html, Runtime } from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Style binding', () => {
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

  it('updates styles with a string', async () => {
    const render = (value: string) => html`<div style=${value}></div>`;

    await root.render(render('color: red')).finished;
    const target = container.querySelector('div')!;
    expect(target.style.color).toBe('red');

    await root.render(render('color: blue')).finished;
    expect(target.style.color).toBe('blue');
  });

  it('updates styles with an object', async () => {
    const render = (value: Record<string, string>) =>
      html`<div style=${value}></div>`;

    await root.render(render({ color: 'red', 'font-size': '16px' })).finished;
    const target = container.querySelector('div')!;
    expect(target.style.color).toBe('red');
    expect(target.style.fontSize).toBe('16px');

    await root.render(render({ color: 'blue' })).finished;
    expect(target.style.color).toBe('blue');
    expect(target.style.fontSize).toBe('');
  });

  it('updates classes with an array', async () => {
    const render = (values: unknown[]) => html`<div style=${values}></div>`;

    await root.render(render(['color: red', { fontSize: '16px' }])).finished;
    const target = container.querySelector('div')!;
    expect(target.style.color).toBe('red');
    expect(target.style.fontSize).toBe('16px');
    expect(target.style.background).toBe('');

    await root.render(render([null, { fontSize: '24px' }, 'background: blue']))
      .finished;
    expect(target.style.color).toBe('');
    expect(target.style.fontSize).toBe('24px');
    expect(target.style.background).toBe('blue');
  });

  it('applies CSS custom properties when specified in the object', async () => {
    const render = (value: Record<string, string>) =>
      html`<div style=${value}></div>`;

    await root.render(render({ '--my-color': 'red', '--my-padding': '8px' }))
      .finished;
    const target = container.querySelector('div')!;
    expect(target.style.getPropertyValue('--my-color')).toBe('red');
    expect(target.style.getPropertyValue('--my-padding')).toBe('8px');
  });

  it('applies vendor-prefixed styles when specified as camelCase keys', async () => {
    const render = (value: Record<string, string>) =>
      html`<div style=${value}></div>`;

    await root.render(render({ webkitTransform: 'rotate(90deg)' })).finished;
    const target = container.querySelector('div')!;
    expect(target.style.getPropertyValue('-webkit-transform')).toBe(
      'rotate(90deg)',
    );
  });

  it.each([
    null,
    undefined,
  ])('removes styles that are set to %s in the object', async (value) => {
    const render = (props: Record<string, string | null | undefined>) =>
      html`<div style=${props}></div>`;

    await root.render(render({ color: 'red', 'font-size': '16px' })).finished;
    const target = container.querySelector('div')!;
    expect(target.style.color).toBe('red');

    await root.render(render({ color: 'red', 'font-size': value })).finished;
    expect(target.style.fontSize).toBe('');
  });

  it('removes styles that are no longer in the fragment', async () => {
    const render = (value: unknown) => {
      return html`<div style=${value}></div>`;
    };

    await root.render(render(['color: red', { fontSize: '16px' }])).finished;
    const target = container.querySelector('div')!;
    expect(target.style.color).toBe('red');
    expect(target.style.fontSize).toBe('16px');

    await root.render(render([])).finished;
    expect(target.style.color).toBe('');
    expect(target.style.fontSize).toBe('');
  });

  it('updates styles from a string to an object', async () => {
    const render = (value: unknown) => html`<div style=${value}></div>`;

    await root.render(render('color: red')).finished;
    const target = container.querySelector('div')!;
    expect(target.style.color).toBe('red');

    await root.render(render({ color: 'blue', 'font-size': '16px' })).finished;
    expect(target.style.color).toBe('blue');
    expect(target.style.fontSize).toBe('16px');
  });

  it('updates styles from an object to a string', async () => {
    const render = (value: unknown) => html`<div style=${value}></div>`;

    await root.render(render({ color: 'red', 'font-size': '16px' })).finished;
    const target = container.querySelector('div')!;
    expect(target.style.color).toBe('red');
    expect(target.style.fontSize).toBe('16px');

    await root.render(render('color: blue')).finished;
    expect(target.style.color).toBe('blue');
    expect(target.style.fontSize).toBe('');
  });
});
