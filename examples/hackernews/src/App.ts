import type { RenderContext } from '@emonkak/ebit';
import { component } from '@emonkak/ebit/extensions';
import { HashLocation, resetScrollPosition } from '@emonkak/ebit/router';

import { Nav } from './Nav.js';
import { NotFound } from './NotFound.js';
import { router } from './router.js';
import type { ItemStore, StoryStore, UserStore } from './store.js';

interface AppProps {
  itemStore: ItemStore;
  storyStore: StoryStore;
  userStore: UserStore;
}

export function App(
  { userStore, itemStore, storyStore }: AppProps,
  context: RenderContext,
): unknown {
  const [locationState] = context.use(HashLocation);
  const page =
    router.handle(locationState.url, locationState.state) ??
    component(NotFound, { url: locationState.url });

  context.use(itemStore);
  context.use(storyStore);
  context.use(userStore);

  context.useLayoutEffect(() => {
    resetScrollPosition(locationState);
  }, [locationState]);

  return context.html`
    <div>
      <${component(Nav, {})}>
      <${page}>
    </div>
  `;
}
