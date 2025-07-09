export { sequentialEqual, shallowEqual } from './compare.js';
export { component } from './component.js';
export type * from './directive.js';
export type * from './hook.js';
export type * from './part.js';
export { BrowserRenderHost } from './render-host/browser.js';
export { ServerRenderHost } from './render-host/server.js';
export { type AsyncRoot, createAsyncRoot } from './root/async.js';
export { createSyncRoot, type SyncRoot } from './root/sync.js';
export type { RuntimeEvent, RuntimeObserver } from './runtime.js';
export { loose } from './slot/loose.js';
export { memo } from './slot/memo.js';
export { strict } from './slot/strict.js';
export {
  HTML_NAMESPACE,
  htmlElement,
  MATH_NAMESPACE,
  mathElement,
  SVG_NAMESPACE,
  svgElement,
} from './template/element-template.js';
export { Literal } from './template-literal.js';
