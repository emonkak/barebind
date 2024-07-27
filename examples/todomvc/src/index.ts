import { ConcurrentUpdater, RenderHost, mount } from '@emonkak/ebit';
import { component } from '@emonkak/ebit/directives.js';

import { App } from './App.js';
import { AppState } from './state.js';

const updater = new ConcurrentUpdater(new RenderHost());

mount(component(App, { state: new AppState() }), document.body, updater);
