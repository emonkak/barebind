import { component, flexible, type RenderContext } from 'barebind';
import { HashHistory, ScrollRestration } from 'barebind/extensions/router';

import { Nav } from './Nav.js';
import { NotFound } from './NotFound.js';
import { router } from './router.js';
import type { AppStore } from './store.js';

interface AppProps {
  store: AppStore;
}

export function App({ store }: AppProps, $: RenderContext): unknown {
  const [location] = $.use(HashHistory);
  const page =
    router.handle(location.url, location.state) ??
    component(NotFound, { url: location.url });

  $.use(store);

  $.use(ScrollRestration);

  return $.html`
    <header class="header">
      <${component(Nav, {})}>
    </header>
    <main class="main">
      <${flexible(page)}>
    </main>
  `;
}
