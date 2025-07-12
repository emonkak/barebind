import { BrowserRenderHost, createAsyncRoot } from '@emonkak/ebit';
import { component, LogReporter, Profiler } from '@emonkak/ebit/extensions';

import { App } from './App.js';
import { ItemStore, StoryStore, UserStore } from './store.js';

const root = createAsyncRoot(
  component(App, {
    storyStore: new StoryStore(),
    itemStore: new ItemStore(),
    userStore: new UserStore(),
  }),
  document.body,
  new BrowserRenderHost(),
);

root.observe(new Profiler(new LogReporter()));

root.mount();
