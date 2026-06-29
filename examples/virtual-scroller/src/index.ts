import { DOMAdapter, DOMRoot, Runtime } from 'barebind';
import { UpdateLogger } from 'barebind/addons/update-logger';
import { UpdateProfiler } from 'barebind/addons/update-profiler';
import { App } from './App.js';

const runtime = new Runtime(new DOMAdapter());
const root = new DOMRoot(document.body, runtime);

runtime.use(new UpdateLogger());
runtime.use(new UpdateProfiler());

root.render(
  App({
    items: Array.from({ length: 1000 }, (_, index) => ({
      label: (index + 1).toString(),
      height: 200 + ((index % 10) - 5) * 20,
    })),
  }),
);
