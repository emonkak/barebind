import { BrowserBackend, component, createAsyncRoot } from '@emonkak/ebit';
import {
  ConsoleReporter,
  RuntimeProfiler,
} from '@emonkak/ebit/extensions/profiler';

import { App } from './App.js';
import { AppStore, ItemState, StoryState, UserState } from './store.js';

const root = createAsyncRoot(
  component(App, {
    store: new AppStore(new ItemState(), new StoryState(), new UserState()),
  }),
  document.body,
  new BrowserBackend(),
);

root.observe(new RuntimeProfiler(new ConsoleReporter()));

root.mount();
