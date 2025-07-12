import { BrowserRenderHost, component, createAsyncRoot } from '@emonkak/ebit';
import { LogReporter, Profiler } from '@emonkak/ebit/extensions';

import { App } from './App.js';
import { TodoStore } from './store.js';

const root = createAsyncRoot(
  component(App, { store: new TodoStore() }),
  document.body,
  new BrowserRenderHost(),
);

root.observe(new Profiler(new LogReporter()));

root.mount();
