import { BrowserBackend, Root, Runtime } from 'barebind';
import { ConsoleReporter, PerformanceProfiler } from 'barebind/extras/profiler';

import { App } from './App.js';
import { TodoState } from './state.js';

const root = Root.create(
  App({ state: new TodoState() }),
  document.body,
  new Runtime(new BrowserBackend()),
);

root.observe(new PerformanceProfiler(new ConsoleReporter()));

root.mount();
