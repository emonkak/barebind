export { sequentialEqual, shallowEqual } from './compare.js';
export {
  createFunctionComponent,
  type FunctionComponent,
  type FunctionComponentContext,
  type FunctionComponentOptions,
} from './component/function.js';
export {
  createIteratorComponent,
  type IteratorComponent,
  type IteratorComponentContext,
  type IteratorComponentOptions,
} from './component/iterator.js';
export {
  ClientAdapter,
  type DOMAdapter,
  type DOMAdapterOptions,
  HydrationAdapter,
} from './dom/adapter.js';
export {
  createClientRoot,
  createDOMRoot,
  createHydrationRoot,
  type DOMRoot,
  type DOMRootOptions,
} from './dom/root.js';
export { AbortError, InterruptError, RenderError } from './error.js';
export { Runtime } from './runtime.js';
export { Partial } from './template/partial.js';
export { html, math, svg, text } from './template/template.js';
