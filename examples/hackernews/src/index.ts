import {
  BrowserRenderHost,
  ConcurrentUpdater,
  createRoot,
} from '@emonkak/ebit';
import { component } from '@emonkak/ebit/directives.js';

import { App } from './App.js';
import { ItemState, StoryState, UserState } from './state.js';

const host = new BrowserRenderHost();
const updater = new ConcurrentUpdater();
const root = createRoot(
  component(App, {
    storyState: new StoryState(),
    itemState: new ItemState(),
    userState: new UserState(),
  }),
  document.body,
  { host, updater },
);

root.mount();
