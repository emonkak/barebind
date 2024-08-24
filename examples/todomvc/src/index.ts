import { ClientRenderHost, ConcurrentUpdater } from '@emonkak/ebit';
import { component } from '@emonkak/ebit/directives.js';

import { App } from './App.js';
import { TodoState } from './state.js';

const host = new ClientRenderHost();
const updater = new ConcurrentUpdater();
const root = host.createRoot(
  component(App, { state: new TodoState() }),
  document.body,
  updater,
);

root.mount();
