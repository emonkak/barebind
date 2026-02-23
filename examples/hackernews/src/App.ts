import { createComponent, Flexible, type RenderContext } from 'barebind';
import { HashHistory, ScrollRestration } from 'barebind/addons/router';

import { Nav } from './Nav.js';
import { NotFound } from './NotFound.js';
import { router } from './router.js';
import type { AppStore } from './store.js';

interface AppProps {
  store: AppStore;
}

export const App = createComponent(function App(
  { store }: AppProps,
  $: RenderContext,
): unknown {
  const { location } = $.use(HashHistory({ viewTransition: true }));
  const page = router.match(location.url) ?? NotFound({ url: location.url });

  $.use(store);

  $.use(ScrollRestration());

  return $.html`
    <header class="header">
      <${Nav({})}>
    </header>
    <main class="main">
      <${Flexible(page)}>
    </main>
  `;
});
