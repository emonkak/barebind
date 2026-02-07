import { BrowserBackend, createComponent, Root, Runtime } from 'barebind';
import { expect, test } from 'vitest';

import { stripComments } from '../test-helpers.js';

test('render a component returning virtual DOM', async () => {
  const value1 = App({
    footerItems: [],
    greet: 'Hello',
    items: [
      { label: 'foo' },
      { label: 'bar' },
      { label: 'baz', hidden: true },
      { label: 'qux' },
    ],
    name: 'World',
  });
  const value2 = App({
    footerItems: [
      { title: 'foo', content: 'bar' },
      { title: 'baz', content: 'qux' },
    ],
    greet: 'Chao',
    items: [
      { label: 'qux' },
      { label: 'baz' },
      { label: 'bar' },
      { label: 'foo' },
    ],
    name: 'Alternative world',
  });
  const container = document.createElement('div');
  const root = Root.create(
    value1,
    container,
    new Runtime(new BrowserBackend()),
  );

  let itemElements: HTMLLIElement[];

  SESSION1: {
    await root.mount().finished;

    itemElements = [...container.querySelectorAll('li')];

    expect(stripComments(container).innerHTML).toBe(
      '<div><ul><li>foo</li><li>bar</li><li>qux</li></ul><p>Hello, World!</p></div>',
    );
    expect(itemElements).toHaveLength(3);
  }

  SESSION2: {
    await root.update(value2).finished;

    expect(stripComments(container).innerHTML).toBe(
      '<div><ul><li>qux</li><li>baz</li><li>bar</li><li>foo</li></ul><p>Chao, Alternative world!</p><dt>foo</dt><dd>bar</dd><dt>baz</dt><dd>qux</dd></div>',
    );
    expect([...container.querySelectorAll('li')]).toStrictEqual([
      expect.exact(itemElements[2]),
      expect.any(HTMLLIElement),
      expect.exact(itemElements[1]),
      expect.exact(itemElements[0]),
    ]);
  }

  SESSION3: {
    await root.unmount().finished;

    expect(container.innerHTML).toBe('');
  }
});

interface AppProps {
  footerItems: FooterItem[];
  greet: string;
  items: Item[];
  name: string;
}

interface Item {
  label: string;
  hidden?: boolean;
}

interface FooterItem {
  title: string;
  content: string;
}

const App = createComponent(function App({
  footerItems,
  greet,
  items,
  name,
}: AppProps) {
  return (
    <div>
      <ul>
        {items.map((item) =>
          item.hidden ? null : <li key={item.label}>{item.label}</li>,
        )}
      </ul>
      <p>
        {greet}, {name}!
      </p>
      {footerItems.length > 0 &&
        footerItems.map((item) => (
          <>
            <dt>{item.title}</dt>
            <dd>{item.content}</dd>
          </>
        ))}
    </div>
  );
});
