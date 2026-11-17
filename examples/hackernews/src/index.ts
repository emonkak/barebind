import { DOMAdapter, DOMRoot, Runtime } from 'barebind';
import { UpdateLogger } from 'barebind/addons/update-logger';
import { UpdateProfiler } from 'barebind/addons/update-profiler';

import { App } from './app.js';
import { AppStore } from './store.js';

const runtime = new Runtime(new DOMAdapter());
const root = new DOMRoot(runtime, document.body);

runtime.use(new UpdateLogger());
runtime.use(new UpdateProfiler());

root.render(
  App({
    store: new AppStore(),
  }),
);
