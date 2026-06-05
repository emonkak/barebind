import { createFragment, DOMAdapter, html, Root, Runtime } from 'barebind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('fragments', () => {
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

  it('reorders keyed fragments in a child node hole', async () => {
    const render = (items: string[]) =>
      html`<ul><${items.map((item) => html`<li>${item}</li>`.withKey(item))}></ul>`;
    await root.render(render(['A', 'B'])).finished;
    expect(container.innerHTML).toBe('<ul><li>A</li><li>B</li><!----></ul>');
    await root.render(render(['B', 'A'])).finished;
    expect(container.innerHTML).toBe('<ul><li>B</li><li>A</li><!----></ul>');
  });

  it('swaps nested fragments', async () => {
    const render = (nestedItems: string[][]) => {
      const children = nestedItems.map((items) =>
        createFragment(
          items.map((item) => html`<li>${item}</li>`.withKey(item)),
        ).withKey(items.toSorted().join('')),
      );
      return html`<ul><${children}></ul>`;
    };
    await root.render(
      render([
        ['A', 'B'],
        ['C', 'D'],
      ]),
    ).finished;
    expect(container.innerHTML).toBe(
      '<ul><li>A</li><li>B</li><li>C</li><li>D</li><!----></ul>',
    );
    await root.render(
      render([
        ['D', 'C'],
        ['B', 'A'],
      ]),
    ).finished;
    expect(container.innerHTML).toBe(
      '<ul><li>D</li><li>C</li><li>B</li><li>A</li><!----></ul>',
    );
  });

  it('reorders fragments when some are empty', async () => {
    const render = (nestedItems: [key: string, items: string[]][]) => {
      const children = nestedItems.map(([key, items]) =>
        createFragment(
          items.map((item) => html`<li>${item}</li>`.withKey(item)),
        ).withKey(key),
      );
      return html`<ul><${children}></ul>`;
    };
    await root.render(
      render([
        ['A', ['A']],
        ['a', []],
        ['B', ['B']],
        ['b', []],
        ['C', ['C']],
        ['c', []],
      ]),
    ).finished;
    expect(container.innerHTML).toBe(
      '<ul><li>A</li><li>B</li><li>C</li><!----></ul>',
    );
    await root.render(
      render([
        ['a', []],
        ['C', ['C']],
        ['b', []],
        ['B', ['B']],
        ['c', []],
        ['A', ['A']],
      ]),
    ).finished;
    expect(container.innerHTML).toBe(
      '<ul><li>C</li><li>B</li><li>A</li><!----></ul>',
    );
  });

  it('replaces keyed fragments', async () => {
    const render = (items: string[]) => {
      const children = createFragment(
        items.map((item) => html`<li>${item}</li>`.withKey(item)),
      ).withKey(items.toSorted().join(''));
      return html`<ul><${children}></ul>`;
    };
    await root.render(render(['A', 'B'])).finished;
    expect(container.innerHTML).toBe('<ul><li>A</li><li>B</li><!----></ul>');
    await root.render(render(['C', 'D'])).finished;
    expect(container.innerHTML).toBe('<ul><li>C</li><li>D</li><!----></ul>');
  });

  it('binds a last value in the list as a text content', async () => {
    const render = (items: string[]) => html`<div>${items}</div>`;
    await root.render(render(['A', 'B'])).finished;
    expect(container.innerHTML).toBe('<div>B</div>');
    await root.render(render(['B', 'A'])).finished;
    expect(container.innerHTML).toBe('<div>A</div>');
  });

  it('removes remaining old children when new list is shorter', async () => {
    const render = (items: string[]) =>
      items.map((item) => html`<div>${item}</div>`.withKey(item));
    await root.render(render(['A', 'B', 'C'])).finished;
    expect(container.innerHTML).toBe('<div>A</div><div>B</div><div>C</div>');
    await root.render(render(['A', 'B'])).finished;
    expect(container.innerHTML).toBe('<div>A</div><div>B</div>');
  });

  it('inserts remaining new children when old list is shorter', async () => {
    const render = (items: string[]) =>
      items.map((item) => html`<div>${item}</div>`.withKey(item));
    await root.render(render(['A', 'B'])).finished;
    expect(container.innerHTML).toBe('<div>A</div><div>B</div>');
    await root.render(render(['A', 'B', 'C'])).finished;
    expect(container.innerHTML).toBe('<div>A</div><div>B</div><div>C</div>');
  });

  it('matches keys at head position', async () => {
    const refs = new Map<string, HTMLDivElement>();
    const render = (items: string[]) =>
      items.map((item) =>
        html`
          <div
            ${(element: HTMLDivElement) => {
              refs.set(item, element);
            }}
          >${item}</div>
        `.withKey(item),
      );
    await root.render(render(['A', 'B', 'C'])).finished;
    const refA = refs.get('A')!;
    await root.render(render(['A', 'B', 'D'])).finished;
    expect(container.innerHTML).toBe('<div>A</div><div>B</div><div>D</div>');
    expect(container.children[0]).toBe(refA);
  });

  it('matches keys at tail position when head differs', async () => {
    const refs = new Map<string, HTMLDivElement>();
    const render = (items: string[]) =>
      items.map((item) =>
        html`<div
          ${(element: HTMLDivElement) => {
            refs.set(item, element);
          }}
        >${item}</div>`.withKey(item),
      );
    await root.render(render(['A', 'C', 'B'])).finished;
    const refB = refs.get('B')!;
    await root.render(render(['D', 'A', 'B'])).finished;
    expect(container.innerHTML).toBe('<div>D</div><div>A</div><div>B</div>');
    expect(container.children[2]).toBe(refB);
  });

  it('swaps head and tail via cross match', async () => {
    const refs = new Map<string, HTMLDivElement>();
    const render = (items: string[]) =>
      items.map((item) =>
        html`<div
          ${(element: HTMLDivElement) => {
            refs.set(item, element);
          }}
        >${item}</div>`.withKey(item),
      );
    await root.render(render(['A', 'B', 'C', 'D'])).finished;
    const refA = refs.get('A')!;
    const refD = refs.get('D')!;
    await root.render(render(['D', 'B', 'C', 'A'])).finished;
    expect(container.innerHTML).toBe(
      '<div>D</div><div>B</div><div>C</div><div>A</div>',
    );
    expect(container.children[0]).toBe(refD);
    expect(container.children[3]).toBe(refA);
  });

  it('removes old head element whose key is absent in new list', async () => {
    const render = (items: string[]) =>
      items.map((item) => html`<div>${item}</div>`.withKey(item));
    await root.render(render(['A', 'B', 'C'])).finished;
    expect(container.innerHTML).toBe('<div>A</div><div>B</div><div>C</div>');
    await root.render(render(['B', 'C', 'D'])).finished;
    expect(container.innerHTML).toBe('<div>B</div><div>C</div><div>D</div>');
  });

  it('removes old tail element whose key is absent in new list', async () => {
    const render = (items: string[]) =>
      items.map((item) => html`<div>${item}</div>`.withKey(item));
    await root.render(render(['A', 'B', 'C'])).finished;
    expect(container.innerHTML).toBe('<div>A</div><div>B</div><div>C</div>');
    await root.render(render(['A', 'D', 'B'])).finished;
    expect(container.innerHTML).toBe('<div>A</div><div>D</div><div>B</div>');
  });

  it('moves elements via key map and skips undefined old-head positions', async () => {
    const refs = new Map<string, HTMLDivElement>();
    const render = (items: string[]) =>
      items.map((item) =>
        html`<div
          ${(element: HTMLDivElement) => {
            refs.set(item, element);
          }}
        >${item}</div>`.withKey(item),
      );
    await root.render(render(['A', 'B', 'C', 'D'])).finished;
    const refA = refs.get('A')!;
    const refB = refs.get('B')!;
    const refC = refs.get('C')!;
    const refD = refs.get('D')!;
    await root.render(render(['C', 'D', 'A', 'B'])).finished;
    expect(container.innerHTML).toBe(
      '<div>C</div><div>D</div><div>A</div><div>B</div>',
    );
    expect(container.children[0]).toBe(refC);
    expect(container.children[1]).toBe(refD);
    expect(container.children[2]).toBe(refA);
    expect(container.children[3]).toBe(refB);
  });

  it('moves element via key map and skips undefined old-tail position', async () => {
    const refs = new Map<string, HTMLDivElement>();
    const render = (items: string[]) =>
      items.map((item) =>
        html`
          <div
            ${(element: HTMLDivElement) => {
              refs.set(item, element);
            }}
          >${item}</div>
        `.withKey(item),
      );
    await root.render(render(['A', 'B', 'C', 'D'])).finished;
    const refA = refs.get('A')!;
    const refB = refs.get('B')!;
    const refC = refs.get('C')!;
    const refD = refs.get('D')!;
    await root.render(render(['B', 'A', 'D', 'C'])).finished;
    expect(container.innerHTML).toBe(
      '<div>B</div><div>A</div><div>D</div><div>C</div>',
    );
    expect(container.children[0]).toBe(refB);
    expect(container.children[1]).toBe(refA);
    expect(container.children[2]).toBe(refD);
    expect(container.children[3]).toBe(refC);
  });

  it('inserts new element when key not found in old key map', async () => {
    const render = (items: string[]) =>
      items.map((item) => html`<div>${item}</div>`.withKey(item));
    await root.render(render(['A', 'B', 'C'])).finished;
    await root.render(render(['D', 'A', 'B', 'E', 'C'])).finished;
    expect(container.innerHTML).toBe(
      '<div>D</div><div>A</div><div>B</div><div>E</div><div>C</div>',
    );
  });
});
