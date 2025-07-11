import { expect, test } from 'vitest';
import { component } from '@/component.js';
import { BrowserRenderHost } from '@/render-host/browser.js';
import { createSyncRoot } from '@/root/sync.js';
import { stripComments } from '../test-utils.js';

test('return a component returning virtual DOM', () => {
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
    items: [],
    name: 'Alternative world',
  });
  const container = document.createElement('div');
  const root = createSyncRoot(value1, container, new BrowserRenderHost());

  root.mount();

  expect(stripComments(container).innerHTML).toBe(
    '<div><ul><li>foo</li><li>bar</li><li>qux</li></ul><p>Hello, World!</p></div>',
  );

  root.update(value2);

  expect(stripComments(container).innerHTML).toBe(
    '<div><ul></ul><p>Chao, Alternative world!</p><dt>foo</dt><dd>bar</dd><dt>baz</dt><dd>qux</dd></div>',
  );

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
        {items.map((item) => (item.hidden ? null : <li>{item.label}</li>))}
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
