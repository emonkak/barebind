import { ClientRenderHost, ConcurrentUpdater, createRoot } from '@emonkak/ebit';
import { component } from '@emonkak/ebit/directives.js';

import { App } from './App.js';
import { TodoState } from './state.js';

const host = new ClientRenderHost();
const updater = new ConcurrentUpdater();
const root = createRoot(
  component(App, { state: new TodoState() }),
  document.body,
  host,
  updater,
);

root.mount();
