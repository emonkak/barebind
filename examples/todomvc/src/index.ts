import {
  BrowserRenderHost,
  ConcurrentUpdater,
  createRoot,
} from '@emonkak/ebit';
import { component } from '@emonkak/ebit/directives.js';

import { App } from './App.js';
import { TodoStore } from './store.js';

const host = new BrowserRenderHost();
const updater = new ConcurrentUpdater();
const root = createRoot(
  component(App, { store: new TodoStore() }),
  document.body,
  { host, updater },
);

root.mount();
