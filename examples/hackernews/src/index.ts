import { AsyncRoot, BrowserBackend } from 'barebind';
import {
  ConsoleReporter,
  PerformanceProfiler,
} from 'barebind/extras/profiler';

import { App } from './App.js';
import { AppStore } from './store.js';

const root = AsyncRoot.create(
  App({
    store: new AppStore(),
  }),
  document.body,
  new BrowserBackend(),
);

root.observe(new PerformanceProfiler(new ConsoleReporter()));

root.mount();
