import { DOMAdapter, DOMRoot, html, Runtime } from 'barebind';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('elements', () => {
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

  it('invokes the ref', async () => {
    const ref = vi.fn();
    const template = html`
      <div ${ref}></div>
    `;
    await root.render(template).finished;

    expect(ref).toHaveBeenCalledOnce();
    expect(ref).toHaveBeenCalledWith(container.querySelector('div'));
  });

  it('invokes the ref bound after attributes', async () => {
    const ref = vi.fn();
    const template = html`
      <div id="a" ${ref}></div>
    `;
    await root.render(template).finished;

    expect(ref).toHaveBeenCalledOnce();
    expect(ref).toHaveBeenCalledWith(container.querySelector('div'));
  });

  it('invokes the ref bound before attributes', async () => {
    const ref = vi.fn();
    const template = html`
      <div ${ref} id="a"></div>
    `;
    await root.render(template).finished;

    expect(ref).toHaveBeenCalledOnce();
    expect(ref).toHaveBeenCalledWith(container.querySelector('div'));
  });

  it('invokes refs in binding order', async () => {
    const elements: Element[] = [];
    const ref = (element: Element) => {
      elements.push(element);
    };
    const template = html`
      <div id="a" ${ref}>
        <${html`<div id="b" ${ref}></div>`}>
      </div>
    `;
    await root.render(template).finished;
    expect(elements).toHaveLength(2);
    expect(elements[0]).toBe(container.querySelector('#a'));
    expect(elements[1]).toBe(container.querySelector('#b'));
  });

  it('invokes the ref with all previous bindings committed', async () => {
    const ref = vi.fn((element: Element) => element.outerHTML);
    const template = html`
      <div id=${'a'} ${ref}>${'b'}</div>
    `;
    await root.render(template).finished;
    expect(ref).toHaveBeenCalledOnce();
    expect(ref).toHaveReturnedWith('<div id="a"></div>');
  });

  it('cleans up the ref when unmounted', async () => {
    const logs: string[] = [];
    const render = (show: boolean) => html`
      <div>
        ${
          show
            ? html`
              <div
                ${() => {
                  logs.push('setup');
                  return () => {
                    logs.push('cleanup');
                  };
                }}
              ></div>
            `
            : null
        }
      </div>
    `;

    await root.render(render(true)).finished;
    expect(logs).toStrictEqual(['setup']);

    await root.render(render(false)).finished;
    expect(logs).toStrictEqual(['setup', 'cleanup']);
  });

  it('throws when an invalid value is used as a ref', async () => {
    const template = html`
      <div ${123}></div>
    `;
    await expect(root.render(template).finished).rejects.toThrow(
      'Element values must be an function, null or undefined.',
    );
  });

  it('throws when an expression is used as an element name', async () => {
    const template = html`
      <${0} id="a">
    `;
    await expect(root.render(template).finished).rejects.toThrow(
      'Expressions inside a comment must make up the entire comment value.',
    );
  });

  it('throws when an expression is used as an element name prefix', async () => {
    const template = html`
      <${0}-x id="a">
    `;
    await expect(root.render(template).finished).rejects.toThrow(
      'Expressions inside a comment must make up the entire comment value.',
    );
  });

  it('throws when an expression is used as an element name suffix', async () => {
    const template = html`
      <x-${0} id="a">
    `;
    await expect(root.render(template).finished).rejects.toThrow(
      'Expressions are not allowed as a tag name.',
    );
  });
});
