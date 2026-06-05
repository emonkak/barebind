import { DOMAdapter, html, Root, Runtime } from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('comment nodes', () => {
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

  it('binds a child node', async () => {
    const template = html`
      <!--${'a'}-->
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<!----><!--a-->');
  });

  it('binds a child node before a slash', async () => {
    const template = html`
      <!-- ${'a'} /-->
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<!----><!--a-->');
  });

  it('throws when an expression is before a constant', async () => {
    const template = html`
      <!-- ${0}-x -->
    `;
    await expect(root.render(template).finished).rejects.toThrow(
      'Expressions inside a comment must make up the entire comment value.',
    );
  });

  it('throws when an expression is after a constant', async () => {
    const template = html`
      <!-- x-${0} -->
    `;
    await expect(root.render(template).finished).rejects.toThrow(
      'Expressions inside a comment must make up the entire comment value.',
    );
  });
});
