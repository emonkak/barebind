import { DOMAdapter, DOMRoot, html, Runtime } from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Class binding', () => {
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

  it('updates classes with a string', async () => {
    const render = (value: unknown) => html`<div class=${value}></div>`;

    await root.render(render('foo')).finished;
    const target = container.querySelector('div')!;
    expect(target.classList.contains('foo')).toBe(true);

    await root.render(render('bar')).finished;
    expect(target.classList.contains('foo')).toBe(false);
    expect(target.classList.contains('bar')).toBe(true);
  });

  it('updates classes with an object', async () => {
    const render = (value: Record<string, boolean>) =>
      html`<div class=${value}></div>`;

    await root.render(render({ active: true, disabled: false })).finished;
    const target = container.querySelector('div')!;
    expect(target.classList.contains('active')).toBe(true);
    expect(target.classList.contains('disabled')).toBe(false);

    await root.render(render({ active: false, disabled: true })).finished;
    expect(target.classList.contains('active')).toBe(false);
    expect(target.classList.contains('disabled')).toBe(true);
  });

  it('updates classes with an array', async () => {
    const render = (values: unknown[]) => html`<div class=${values}></div>`;

    await root.render(render(['foo', { bar: false }])).finished;
    const target = container.querySelector('div')!;
    expect(target.classList.contains('foo')).toBe(true);
    expect(target.classList.contains('bar')).toBe(false);
    expect(target.classList.contains('baz')).toBe(false);

    await root.render(render([null, { bar: true }, 'baz'])).finished;
    expect(target.classList.contains('foo')).toBe(false);
    expect(target.classList.contains('bar')).toBe(true);
    expect(target.classList.contains('baz')).toBe(true);
  });

  it.each([
    null,
    undefined,
  ])('removes classes when the value is %s', async (value) => {
    const render = (value: unknown) => html`<div class=${value}></div>`;

    await root.render(render('foo')).finished;
    const target = container.querySelector('div')!;
    expect(target.classList.contains('foo')).toBe(true);

    await root.render(render(value)).finished;
    expect(target.classList.contains('foo')).toBe(false);
  });

  it('removes classes that are no longer in the object', async () => {
    const render = (value: Record<string, boolean>) => {
      return html`<div class=${value}></div>`;
    };

    await root.render(render({ active: true, disabled: true })).finished;
    const target = container.querySelector('div')!;
    expect(target.classList.contains('active')).toBe(true);
    expect(target.classList.contains('disabled')).toBe(true);

    await root.render(render({ active: true })).finished;
    expect(target.classList.contains('active')).toBe(true);
    expect(target.classList.contains('disabled')).toBe(false);
  });

  it('removes classes that are no longer in the fragment', async () => {
    const render = (value: unknown) => {
      return html`<div class=${value}></div>`;
    };

    await root.render(render(['foo', { bar: true }])).finished;
    const target = container.querySelector('div')!;
    expect(target.classList.contains('foo')).toBe(true);
    expect(target.classList.contains('bar')).toBe(true);

    await root.render(render([])).finished;
    expect(target.classList.contains('foo')).toBe(false);
    expect(target.classList.contains('bar')).toBe(false);
  });

  it('updates classes from a string to an object', async () => {
    const render = (value: unknown) => html`<div class=${value}></div>`;

    await root.render(render('foo')).finished;
    const target = container.querySelector('div')!;
    expect(target.classList.contains('foo')).toBe(true);
    expect(target.classList.contains('bar')).toBe(false);

    await root.render(render({ foo: false, bar: true })).finished;
    expect(target.classList.contains('foo')).toBe(false);
    expect(target.classList.contains('bar')).toBe(true);
  });

  it('updates classes from an object to a string', async () => {
    const render = (value: unknown) => html`<div class=${value}></div>`;

    await root.render(render({ foo: true, bar: false })).finished;
    const target = container.querySelector('div')!;
    expect(target.classList.contains('foo')).toBe(true);
    expect(target.classList.contains('bar')).toBe(false);

    await root.render(render('bar')).finished;
    expect(target.classList.contains('foo')).toBe(false);
    expect(target.classList.contains('bar')).toBe(true);
  });
});
