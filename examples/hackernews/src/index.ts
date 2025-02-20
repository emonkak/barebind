import {
  BrowserRenderHost,
  ConcurrentUpdater,
  createRoot,
} from '@emonkak/ebit';
import { component } from '@emonkak/ebit/directives.js';

import { App } from './App.js';
import { ItemState, StoryStore, UserStore } from './store.js';

const host = new BrowserRenderHost();
const updater = new ConcurrentUpdater();
const root = createRoot(
  component(App, {
    storyState: new StoryStore(),
    itemState: new ItemState(),
    userState: new UserStore(),
  }),
  document.body,
  { host, updater },
);

root.mount();
