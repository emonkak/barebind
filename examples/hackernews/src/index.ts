import { BrowserBackend, Root, Runtime } from 'barebind';
import { ConsoleReporter, PerformanceProfiler } from 'barebind/addons/profiler';

import { App } from './App.js';
import { AppStore } from './store.js';

const runtime = new Runtime(new BrowserBackend());
const root = Root.create(
  App({
    store: new AppStore(),
  }),
  document.body,
  runtime,
);

runtime.addObserver(new PerformanceProfiler(new ConsoleReporter()));

root.mount();
