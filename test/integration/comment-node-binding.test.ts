import { DOMAdapter, DOMRoot, html, Runtime } from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Comment node binding', () => {
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

  it('binds a value to the comment node', async () => {
    const template = html`
      <!--${'a'}-->
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<!----><!--a-->');
  });

  it('binds a value to the comment node before a slash', async () => {
    const template = html`
      <!-- ${'a'} /-->
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<!----><!--a-->');
  });

  it('updates a comment node', async () => {
    const render = (value: string) => html`
      <!--${value}-->
    `;
    await root.render(render('a')).finished;
    await root.render(render('b')).finished;
    expect(container.innerHTML).toBe('<!----><!--b-->');
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
