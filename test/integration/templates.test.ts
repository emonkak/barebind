import { DOMAdapter, DOMRoot, html, math, Runtime, svg, text } from 'barebind';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('templates', () => {
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

  it('renders an HTML template', async () => {
    const template = html`
      <div id="a">hello</div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<div id="a">hello</div>');
    expect(container.querySelector('div')?.namespaceURI).toBe(
      'http://www.w3.org/1999/xhtml',
    );
  });

  it('renders a MathML template', async () => {
    const template = math`
      <mn id="a">100</mn>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('<mn id="a">100</mn>');
    expect(container.querySelector('mn')?.namespaceURI).toBe(
      'http://www.w3.org/1998/Math/MathML',
    );
  });

  it('renders an SVG template', async () => {
    const template = svg`
      <rect id="a" width="100" height="100"></rect>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe(
      `<rect id="a" width="100" height="100"></rect>`,
    );
    expect(container.querySelector('rect')?.namespaceURI).toBe(
      'http://www.w3.org/2000/svg',
    );
  });

  it('renders a text template', async () => {
    const template = text`
      <div>hello</div>
    `;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('&lt;div&gt;hello&lt;/div&gt;');
  });

  it('renders an empty template', async () => {
    const template = html``;
    await root.render(template).finished;
    expect(container.innerHTML).toBe('');
  });

  describe('nested templates', () => {
    it('warns when mounting a template block in a text hole', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const template = html`
        <div>${html`<span>nested</span>`}</div>
      `;
      await root.render(template).finished;

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Template blocks can only be mounted as child nodes. ',
        ),
      );
    });

    it('does not warn when mounting a template block in a child node hole', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const template = html`
        <div>
          <${html`<span>nested</span>`}>
        </div>
      `;
      await root.render(template).finished;

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
