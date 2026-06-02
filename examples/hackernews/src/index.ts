import { DOMAdapter, Root, Runtime } from 'barebind';

import { App } from './App.js';
import { AppStore } from './store.js';

const runtime = new Runtime(new DOMAdapter());
const root = new Root(document.body, runtime);

root.render(
  App({
    store: new AppStore(),
  }),
);
