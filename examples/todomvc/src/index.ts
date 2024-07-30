import { ConcurrentUpdater, UpdateController } from '@emonkak/ebit';
import { component } from '@emonkak/ebit/directives.js';

import { App } from './App.js';
import { AppState } from './state.js';

const controller = new UpdateController();
const updater = new ConcurrentUpdater();

controller.mount(
  component(App, { state: new AppState() }),
  document.body,
  updater,
);
