import { ConcurrentUpdater, UpdateHost } from '@emonkak/ebit';
import { component } from '@emonkak/ebit/directives.js';

import { App } from './App.js';
import { AppState } from './state.js';

const host = new UpdateHost();
const updater = new ConcurrentUpdater();

host.mount(component(App, { state: new AppState() }), document.body, updater);
