import { createComponent, html } from 'barebind';
import { HashAdapter, Navigation } from 'barebind/addons/router';

import { Nav } from './Nav.js';
import { NotFound } from './NotFound.js';
import { router } from './router.js';
import type { AppStore } from './store.js';

interface AppProps {
  store: AppStore;
}

export const App = createComponent<AppProps>(function App({ store }) {
  const adapter = this.useMemo(() => new HashAdapter(), []);
  const { scene } = this.use(
    Navigation(adapter, () => ({ viewTransition: true })),
  );
  const page = router.match(scene.url) ?? NotFound({ url: scene.url });

  this.provide(store);

  return html`
    <header class="header">
      <${Nav({})}>
    </header>
    <main class="main">
      <${page}>
    </main>
  `;
});
