import { createComponent, html } from 'barebind';
import { HashHistory, ScrollRestration } from 'barebind/addons/router';

import { Nav } from './Nav.js';
import { NotFound } from './NotFound.js';
import { router } from './router.js';
import type { AppStore } from './store.js';

interface AppProps {
  store: AppStore;
}

export const App = createComponent<AppProps>(function App({ store }) {
  const { location } = this.use(HashHistory());
  const page = router.match(location.url) ?? NotFound({ url: location.url });

  this.provide(store);

  this.use(ScrollRestration());

  return html`
    <header class="header">
      <${Nav({})}>
    </header>
    <main class="main">
      <${page}>
    </main>
  `;
});
