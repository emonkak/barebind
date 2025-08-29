import { BrowserBackend, Root, Runtime } from 'barebind';
import { ConsoleReporter, PerformanceProfiler } from 'barebind/extras/profiler';

import { App } from './App.js';
import { AppStore } from './store.js';

const root = Root.create(
  App({
    store: new AppStore(),
  }),
  document.body,
  new Runtime(new BrowserBackend()),
);

root.observe(new PerformanceProfiler(new ConsoleReporter()));

root.mount();
