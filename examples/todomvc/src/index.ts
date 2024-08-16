import { ConcurrentUpdater, UpdateHost } from '@emonkak/ebit';
import { component } from '@emonkak/ebit/directives.js';

import { App } from './App.js';
import { TodoState } from './state.js';

const host = new UpdateHost();
const updater = new ConcurrentUpdater();

host.mount(component(App, { state: new TodoState() }), document.body, updater);
