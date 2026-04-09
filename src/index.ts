export { sequentialEqual, shallowEqual } from './compare.js';
export {
  type ComponentFunction,
  type ComponentFunctionOptions,
  createComponent,
  type RenderContext,
  type Usable,
} from './component.js';
export {
  ClientAdapter,
  type DOMAdapter,
  type DOMAdapterOptions,
  HydrationAdapter,
} from './dom/adapter.js';
export {
  createClientRoot,
  createHydrationRoot,
  createRoot,
  type DOMRoot,
} from './dom/root.js';
export { RenderError } from './error.js';
export { Runtime } from './runtime.js';
export { Partial } from './template/partial.js';
export { html, math, svg, text } from './template/template.js';
