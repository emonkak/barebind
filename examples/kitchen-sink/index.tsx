import { BrowserBackend, Root, Runtime } from 'barebind';
import { ConsoleReporter, PerformanceProfiler } from 'barebind/addons/profiler';

import { App } from './App.js';

const runtime = new Runtime(new BrowserBackend());
const root = Root.create(App({}), document.body, runtime);

runtime.addObserver(new PerformanceProfiler(new ConsoleReporter()));

root.mount();
