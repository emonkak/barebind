import { DOMAdapter, DOMRoot, Runtime } from 'barebind';
import { App } from './App.js';
import { TodoState, TodoStore } from './state.js';

const runtime = new Runtime(new DOMAdapter());
const root = new DOMRoot(document.body, runtime);

root.render(App({ store: new TodoStore(new TodoState()) }));
