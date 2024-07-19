import { ConcurrentUpdater, RenderState, mount } from '@emonkak/ebiten';
import { component } from '@emonkak/ebiten/directives.js';

import { App } from './App.js';
import { AppState } from './state.js';

const updater = new ConcurrentUpdater(new RenderState());

mount(component(App, { state: new AppState() }), document.body, updater);
