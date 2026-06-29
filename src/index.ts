export { sequentialEqual, shallowEqual } from './compare.js';
export {
  createComponent,
  type HookFunction,
  type HookObject,
  RenderContext,
} from './component.js';
export {
  type Commit,
  type Component,
  createBind,
  createFragment,
  createPortal,
  createTemplate,
  type Lanes,
  Ref,
  type Transaction,
  toElement,
  type UpdateHandle,
  type UpdateOptions,
  type VBind,
  type VComponent,
  type VElement,
  type VPortal,
  type VTemplate,
} from './core.js';
export { DOMAdapter } from './dom/adapter.js';
export { DOMAdapterError } from './dom/error.js';
export { DOMRoot } from './dom/root.js';
export { RenderError } from './error.js';
export { Runtime, waitForStep } from './runtime.js';
export { html, math, Partial, svg, text } from './template.js';
