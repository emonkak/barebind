import type { RenderContext, TemplateDirective } from '@emonkak/ebit';
import { component, memo } from '@emonkak/ebit/directives.js';
import { hashLocation } from '@emonkak/ebit/router.js';

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
): TemplateDirective {
  const locationState = context.use(hashLocation);
  const page =
    router.dispatch(locationState.url, locationState.state) ??
    component(NotFound, { url: locationState.url });

  context.use(itemState);
  context.use(storyState);
  context.use(userState);

  return context.html`
    <div>
      <${memo(() => component(Nav, {}), [])}>
      <${page}>
    </div>
  `;
}
