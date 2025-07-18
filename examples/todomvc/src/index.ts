import { BrowserBackend, component, createAsyncRoot } from '@emonkak/ebit';
import {
  ConsoleReporter,
  RuntimeProfiler,
} from '@emonkak/ebit/extensions/profiler';

import { App } from './App.js';
import { TodoStore } from './store.js';

const root = createAsyncRoot(
  component(App, { store: new TodoStore() }),
  document.body,
  new BrowserBackend(),
);

root.observe(new RuntimeProfiler(new ConsoleReporter()));

root.mount();
