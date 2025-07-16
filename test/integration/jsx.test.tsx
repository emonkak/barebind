import { expect, test } from 'vitest';
import { BrowserBackend } from '@/backend/browser.js';
import { component } from '@/extensions/component.js';
import { createSyncRoot } from '@/root/sync.js';
import { filterComments, stripComments } from '../test-utils.js';

test('render a component returning virtual DOM', () => {
  const value1 = component(App, {
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
  const value2 = component(App, {
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
  const root = createSyncRoot(value1, container, new BrowserBackend());

  root.mount();

  const itemNodes = filterComments(
    container.querySelector('ul')?.childNodes ?? [],
  );

  expect(stripComments(container).innerHTML).toBe(
    '<div><ul><li>foo</li><li>bar</li><li>qux</li></ul><p>Hello, World!</p></div>',
  );
  expect(itemNodes).toHaveLength(3);

  root.update(value2);

  expect(stripComments(container).innerHTML).toBe(
    '<div><ul><li>qux</li><li>baz</li><li>bar</li><li>foo</li></ul><p>Chao, Alternative world!</p><dt>foo</dt><dd>bar</dd><dt>baz</dt><dd>qux</dd></div>',
  );
  expect(
    filterComments(container.querySelector('ul')?.childNodes ?? []),
  ).toStrictEqual([
    expect.exact(itemNodes[2]),
    expect.any(HTMLLIElement),
    expect.exact(itemNodes[1]),
    expect.exact(itemNodes[0]),
  ]);

  root.unmount();

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

function App({ footerItems, greet, items, name }: AppProps) {
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
}
