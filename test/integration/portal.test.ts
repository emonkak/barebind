import { createPortal, DOMAdapter, html, Root, Runtime } from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('portal', () => {
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

  it('renders portal content in the target element', async () => {
    const portal = createPortal(
      html`<div>hello</div>`,
      document.createElement('div'),
    );
    const template = html`<div><${portal}></div>`;

    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div><!----><!----></div>');
    expect(portal.type.innerHTML).toBe('<div>hello</div>');
  });

  it('renders nested portals', async () => {
    const innerPortal = createPortal(
      html`<div>a</div>`,
      document.createElement('div'),
    );
    const outerPortal = createPortal(
      innerPortal,
      document.createElement('div'),
    );

    await root.render(outerPortal).finished;
    expect(container.innerHTML).toBe('<!---->');
    expect(innerPortal.type.innerHTML).toBe('<div>a</div>');
    expect(outerPortal.type.innerHTML).toBe('<!---->');
  });

  it('does nothing when portals are swapped', async () => {
    const portalA = createPortal(
      html`<div>a</div>`,
      document.createElement('div'),
    ).withKey('a');
    const portalB = createPortal(
      html`<div>b</div>`,
      document.createElement('div'),
    ).withKey('b');
    const render = (children: unknown[]) => html`<div><${children}></div>`;

    await root.render(render([portalA, portalB])).finished;
    expect(container.innerHTML).toBe('<div><!----><!----><!----></div>');
    expect(portalA.type.innerHTML).toBe('<div>a</div>');
    expect(portalB.type.innerHTML).toBe('<div>b</div>');

    await root.render(render([portalB, portalA])).finished;
    expect(container.innerHTML).toBe('<div><!----><!----><!----></div>');
    expect(portalA.type.innerHTML).toBe('<div>a</div>');
    expect(portalB.type.innerHTML).toBe('<div>b</div>');
  });

  it('preserves portal content when items are reordered', async () => {
    const portalA = createPortal(
      html`<div>a</div>`,
      document.createElement('div'),
    ).withKey('a');
    const templateB = html`<div>b</div>`.withKey('b');
    const templateC = html`<div>c</div>`.withKey('c');
    const render = (children: unknown[]) => html`<div><${children}></div>`;

    await root.render(render([portalA, templateB, templateC])).finished;
    expect(container.innerHTML).toBe(
      '<div><!----><div>b</div><div>c</div><!----></div>',
    );
    expect(portalA.type.innerHTML).toBe('<div>a</div>');

    await root.render(render([templateC, portalA, templateB])).finished;
    expect(container.innerHTML).toBe(
      '<div><div>c</div><!----><div>b</div><!----></div>',
    );
    expect(portalA.type.innerHTML).toBe('<div>a</div>');
  });

  it('removes portal content when root is replaced', async () => {
    const portal = createPortal(
      html`<div>hello</div>`,
      document.createElement('div'),
    );

    await root.render(html`<div><${portal}></div>`).finished;
    await root.render(null).finished;
    expect(container.innerHTML).toBe('');
    expect(portal.type.innerHTML).toBe('');
  });

  it('removes portal content when the child node is replaced', async () => {
    const portal = createPortal(
      html`<div>hello</div>`,
      document.createElement('div'),
    );
    const render = (child: unknown) => html`<div><${child}></div>`;

    await root.render(render(portal)).finished;
    await root.render(render(null)).finished;
    expect(container.innerHTML).toBe('<div><!----></div>');
    expect(portal.type.innerHTML).toBe('');
  });
});
