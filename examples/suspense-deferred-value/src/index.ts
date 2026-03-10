import { BrowserBackend, Root, Runtime } from 'barebind';
import {
  ConsoleReporter,
  SessionProfiler,
} from 'barebind/addons/session-profiler';

import { App } from './App.js';

const runtime = new Runtime(new BrowserBackend());
const root = Root.create(App({}), document.body, runtime);

runtime.addObserver(new SessionProfiler(new ConsoleReporter()));

root.mount();
