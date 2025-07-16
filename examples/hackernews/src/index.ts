import { BrowserBackend, createAsyncRoot } from '@emonkak/ebit';
import {
  ConsoleReporter,
  component,
  RuntimeProfiler,
} from '@emonkak/ebit/extensions';

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
