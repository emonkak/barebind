import { DOMAdapter, DOMRoot, html, Runtime } from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Attribute binding', () => {
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

  it('binds a value to the attribute', async () => {
    const template = html`
      <div data-a=${'a'}></div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div data-a="a"></div>');
  });

  it('binds a value to the double-quoted attribute', async () => {
    const template = html`
      <div data-a="${'a'}"></div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div data-a="a"></div>');
  });

  it('binds a value to the single-quoted attribute', async () => {
    const template = html`
      <div data-a='${'a'}'></div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div data-a="a"></div>');
  });

  it('binds a value to multiple attributes', async () => {
    const template = html`
      <div data-a=${'a'} data-b=${'b'} data-c=${'c'}></div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe(
      '<div data-a="a" data-b="b" data-c="c"></div>',
    );
  });

  it('sets a string representation of the number as an attribute', async () => {
    const template = html`<div data-a=${123}></div>`;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div data-a="123"></div>');
  });

  it('sets a string representation of the object as an attribute', async () => {
    const template = html`<div data-a=${{ toString: () => 'a' }}></div>`;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div data-a="a"></div>');
  });

  it('sets an empty string when the object has no prototype', async () => {
    const template = html`<div data-a=${{ __proto__: null }}></div>`;

    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div data-a=""></div>');
  });

  it('creates empty attributes when the value is true', async () => {
    const template = html`<div data-a=${true}></div>`;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div data-a=""></div>');
  });

  it.each([
    null,
    undefined,
    false,
  ])('removes attributes when the value is %s', async (value) => {
    const render = (value: unknown) => html`<div data-a=${value}></div>`;

    await root.render(render('a')).finished;
    expect(container.innerHTML).toBe('<div data-a="a"></div>');

    await root.render(render(value)).finished;
    expect(container.innerHTML).toBe('<div></div>');
  });

  it('throws when an expression is used as an attribute name', async () => {
    const template = html`
      <div ${'a'}="b"></div>
    `;
    await expect(root.render(template).finished).rejects.toThrow(
      'Expressions are not allowed as an attribute name.',
    );
  });

  it('throws when an expression is used as an attribute name prefix', async () => {
    const template = html`
      <div ${'a'}-x="b"></div>
    `;
    await expect(root.render(template).finished).rejects.toThrow(
      'Expressions are not allowed as an attribute name.',
    );
  });

  it('throws when an expression is used as an attribute name suffix', async () => {
    const template = html`
      <div x-${'a'}="b"></div>
    `;
    await expect(root.render(template).finished).rejects.toThrow(
      'Expressions are not allowed as an attribute name.',
    );
  });

  it('throws when an attribute is missing', async () => {
    const template = html`
      <div id="a" id=${'b'}></div>
    `;
    await expect(root.render(template).finished).rejects.toThrow(
      'The number of holes must be 1, but got 0.',
    );
  });

  it('throws when attribute names are mismatched', async () => {
    const template = html`
      <div id="a" id=${'b'} class=${'c'}></div>
    `;
    await expect(root.render(template).finished).rejects.toThrow(
      'The attribute name must be "class", but got "id".',
    );
  });

  it('throws when an attribute value is before a constant', async () => {
    const template = html`
      <div class="${'a'} b"></div>
    `;
    await expect(root.render(template).finished).rejects.toThrow(
      'Expressions inside an attribute must make up the entire attribute value.',
    );
  });

  it('throws when an attribute value is after a constant', async () => {
    const template = html`
      <div class="a ${'b'}"></div>
    `;
    await expect(root.render(template).finished).rejects.toThrow(
      'Expressions inside an attribute must make up the entire attribute value.',
    );
  });
});
