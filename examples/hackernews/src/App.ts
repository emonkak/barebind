import { component, memo, type RenderContext } from '@emonkak/ebit';
import {
  HashLocation,
  resetScrollPosition,
} from '@emonkak/ebit/extensions/router';

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
  const [locationSnapshot] = context.use(HashLocation);
  const page =
    router.handle(locationSnapshot.url, locationSnapshot.state) ??
    component(NotFound, { url: locationSnapshot.url });

  context.use(itemStore);
  context.use(storyStore);
  context.use(userStore);

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
