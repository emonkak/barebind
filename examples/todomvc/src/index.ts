import { AsyncRoot, BrowserBackend, component } from '@emonkak/ebit';
import {
  ConsoleReporter,
  PerformanceProfiler,
} from '@emonkak/ebit/extensions/profiler';

import { App } from './App.js';
import { TodoState } from './state.js';

const root = AsyncRoot.create(
  component(App, { state: new TodoState() }),
  document.body,
  new BrowserBackend(),
);

root.observe(new PerformanceProfiler(new ConsoleReporter()));

root.mount();
