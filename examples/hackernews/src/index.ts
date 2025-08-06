import { AsyncRoot, BrowserBackend, component } from '@emonkak/ebit';
import {
  ConsoleReporter,
  PerformanceProfiler,
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

root.observe(new PerformanceProfiler(new ConsoleReporter()));

root.mount();
