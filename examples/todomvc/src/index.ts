import { BrowserBackend, Root, Runtime } from 'barebind';
import {
  ConsoleReporter,
  SessionProfiler,
} from 'barebind/addons/session-profiler';

import { App } from './App.js';
import { TodoState, TodoStore } from './state.js';

const runtime = new Runtime(new BrowserBackend());
const root = Root.create(
  App({ store: new TodoStore(new TodoState()) }),
  document.body,
  runtime,
);

runtime.addObserver(new SessionProfiler(new ConsoleReporter()));

root.mount();
