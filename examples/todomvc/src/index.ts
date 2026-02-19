import { BrowserBackend, Root, Runtime } from 'barebind';
import {
  ConsoleReporter,
  RuntimeProfiler,
} from 'barebind/addons/runtime-profiler';

import { App } from './App.js';
import { TodoState } from './state.js';

const runtime = new Runtime(new BrowserBackend());
const root = Root.create(
  App({ state: new TodoState() }),
  document.body,
  runtime,
);

runtime.addObserver(new RuntimeProfiler(new ConsoleReporter()));

root.mount();
