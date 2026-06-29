import { DOMAdapter, DOMRoot, Runtime } from 'barebind';
import { UpdateLogger } from 'barebind/addons/update-logger';

import { App } from './App.js';
import { AppStore } from './store.js';

const runtime = new Runtime(new DOMAdapter());
const root = new DOMRoot(document.body, runtime);

runtime.use(new UpdateLogger());

root.render(
  App({
    store: new AppStore(),
  }),
);
