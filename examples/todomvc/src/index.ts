import { BrowserBackend, component, createAsyncRoot } from '@emonkak/ebit';
import {
  ConsoleReporter,
  RuntimeProfiler,
} from '@emonkak/ebit/extensions/profiler';

import { App } from './App.js';
import { TodoState } from './state.js';

const root = createAsyncRoot(
  component(App, { state: new TodoState() }),
  document.body,
  new BrowserBackend(),
);

root.observe(new RuntimeProfiler(new ConsoleReporter()));

root.mount();
