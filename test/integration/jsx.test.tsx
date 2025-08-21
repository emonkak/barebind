import { expect, test } from 'vitest';
import { BrowserBackend } from '@/backend/browser.js';
import { createComponent } from '@/component.js';
import { Root } from '@/root.js';
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
  const root = Root.create(value1, container, new BrowserBackend());

  await root.mount();

  const items = [...container.querySelectorAll('li')];

  expect(stripComments(container).innerHTML).toBe(
    '<div><ul><li>foo</li><li>bar</li><li>qux</li></ul><p>Hello, World!</p></div>',
  );
  expect(items).toHaveLength(3);

  await root.update(value2);

  expect(stripComments(container).innerHTML).toBe(
    '<div><ul><li>qux</li><li>baz</li><li>bar</li><li>foo</li></ul><p>Chao, Alternative world!</p><dt>foo</dt><dd>bar</dd><dt>baz</dt><dd>qux</dd></div>',
  );
  expect([...container.querySelectorAll('li')]).toStrictEqual([
    expect.exact(items[2]),
    expect.any(HTMLLIElement),
    expect.exact(items[1]),
    expect.exact(items[0]),
  ]);

  await root.unmount();

  expect(container.innerHTML).toBe('');
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
