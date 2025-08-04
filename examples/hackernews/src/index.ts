import { AsyncRoot, BrowserBackend, component } from '@emonkak/ebit';
import {
  ConsoleReporter,
  RuntimeProfiler,
} from '@emonkak/ebit/extensions/profiler';

import { App } from './App.js';
import { AppStore } from './store.js';

const root = AsyncRoot.create(
  component(App, {
    store: new AppStore(),
  }),
  document.body,
  new BrowserBackend(),
);

root.observe(new RuntimeProfiler(new ConsoleReporter()));

root.mount();
