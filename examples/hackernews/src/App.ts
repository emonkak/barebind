import type { RenderContext, TemplateResult } from '@emonkak/ebit';
import { component, memo } from '@emonkak/ebit/directives.js';
import { hashLocation, resetScrollPosition } from '@emonkak/ebit/router.js';

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
): TemplateResult {
  const [locationState] = context.use(hashLocation);
  const page =
    router.handle(locationState.url, locationState.state) ??
    component(NotFound, { url: locationState.url });

  context.use([itemStore, storyStore, userStore]);

  context.useLayoutEffect(() => {
    resetScrollPosition(locationState);
  }, [locationState]);

  return context.html`
    <div>
      <${memo(() => component(Nav, {}), [])}>
      <${page}>
    </div>
  `;
}
