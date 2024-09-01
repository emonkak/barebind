import type { RenderContext, TemplateResult } from '@emonkak/ebit';
import { component, memo } from '@emonkak/ebit/directives.js';
import { hashLocation, resetScrollPosition } from '@emonkak/ebit/location.js';

import { Nav } from './Nav.js';
import { NotFound } from './NotFound.js';
import { router } from './router.js';
import type { ItemState, StoryState, UserState } from './state.js';

interface AppProps {
  itemState: ItemState;
  storyState: StoryState;
  userState: UserState;
}

export function App(
  { userState, itemState, storyState }: AppProps,
  context: RenderContext,
): TemplateResult {
  const [locationState] = context.use(hashLocation);
  const page =
    router.match(locationState.url, locationState.state) ??
    component(NotFound, { url: locationState.url });

  context.use([itemState, storyState, userState]);

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
