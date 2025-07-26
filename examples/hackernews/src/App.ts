import { component, memo, type RenderContext } from '@emonkak/ebit';
import {
  HashLocation,
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
  const [locationSnapshot] = context.use(HashLocation);
  const page =
    router.handle(locationSnapshot.url, locationSnapshot.state) ??
    component(NotFound, { url: locationSnapshot.url });

  context.use(store);

  context.useLayoutEffect(() => {
    resetScrollPosition(locationSnapshot);
  }, [locationSnapshot]);

  return context.html`
    <div>
      <${component(Nav, {})}>
      <${memo(page)}>
    </div>
  `;
}
