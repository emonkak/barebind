import { component, memo, type RenderContext } from '@emonkak/ebit';
import {
  HashHistory,
  resetScrollPosition,
} from '@emonkak/ebit/extensions/router';

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

  context.useLayoutEffect(() => {
    resetScrollPosition(location);
  }, [location]);

  return context.html`
    <div>
      <${component(Nav, {})}>
      <${memo(page)}>
    </div>
  `;
}
