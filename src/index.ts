export { sequentialEqual, shallowEqual } from './compare.js';
export * from './core.js';
export { BrowserHostEnvironment } from './host-environment/browser.js';
export { ServerHostEnvironment } from './host-environment/server.js';
export { HydrationError, type HydrationTree } from './hydration.js';
export {
  type AttributePart,
  type ChildNodePart,
  type ElementPart,
  type EventPart,
  type LivePart,
  type Part,
  PartType,
  type PropertyPart,
  type TextPart,
} from './part.js';
export { type AsyncRoot, createAsyncRoot } from './root/async.js';
export { createSyncRoot, type SyncRoot } from './root/sync.js';
export type { RuntimeEvent, RuntimeObserver } from './runtime.js';
export type { Scope } from './scope.js';
export { loose } from './slot/loose.js';
export { memo } from './slot/memo.js';
export { strict } from './slot/strict.js';
export { element } from './template/element.js';
export { Literal, type TemplateLiteral } from './template-literal.js';
