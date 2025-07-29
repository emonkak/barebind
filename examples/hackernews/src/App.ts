import { component, memo, type RenderContext } from '@emonkak/ebit';
import { HashHistory, ScrollRestration } from '@emonkak/ebit/extensions/router';

import { Nav } from './Nav.js';
import { NotFound } from './NotFound.js';
import { router } from './router.js';
import type { AppStore } from './store.js';

interface AppProps {
  store: AppStore;
}

export function App({ store }: AppProps, context: RenderContext): unknown {
  const [location] = context.use(HashHistory);
  const page =
    router.handle(location.url, location.state) ??
    component(NotFound, { url: location.url });

  context.use(store);

  context.use(ScrollRestration);

  return context.html`
    <header class="header">
      <${component(Nav, {})}>
    </header>
    <main class="main">
      <${memo(page)}>
    </main>
  `;
}
