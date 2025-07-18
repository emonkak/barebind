import { BrowserBackend, component, createAsyncRoot } from '@emonkak/ebit';
import {
  ConsoleReporter,
  RuntimeProfiler,
} from '@emonkak/ebit/extensions/profiler';

import { App } from './App.js';
import { ItemStore, StoryStore, UserStore } from './store.js';

const root = createAsyncRoot(
  component(App, {
    storyStore: new StoryStore(),
    itemStore: new ItemStore(),
    userStore: new UserStore(),
  }),
  document.body,
  new BrowserBackend(),
);

root.observe(new RuntimeProfiler(new ConsoleReporter()));

root.mount();
