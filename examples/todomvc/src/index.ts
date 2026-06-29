import { DOMAdapter, DOMRoot, Runtime } from 'barebind';
import { UpdateLogger } from 'barebind/addons/update-logger';
import { UpdateProfiler } from 'barebind/addons/update-profiler';
import { App } from './App.js';
import { TodoState, TodoStore } from './state.js';

const runtime = new Runtime(new DOMAdapter());
const root = new DOMRoot(document.body, runtime);

runtime.use(new UpdateLogger());
runtime.use(new UpdateProfiler());

root.render(App({ store: new TodoStore(new TodoState()) }));
