import { ClientAdapter, type DOMAdapterOptions } from '@/dom/adapter.js';
import { createChildNodePart, type DOMPart } from '@/dom/part.js';
import { Root } from '@/dom/root.js';
import type { DOMRenderer } from '@/dom/template.js';
import { SyncLane } from '@/lane.js';
import { Runtime, type RuntimeOptions } from '@/runtime.js';
import { Slot } from '@/slot.js';

export class TestAdapter extends ClientAdapter {
  override requestCallback<T>(callback: () => T | PromiseLike<T>): Promise<T> {
    return Promise.resolve().then(callback);
  }

  override yieldToMain(): Promise<void> {
    return Promise.resolve();
  }
}

export function createTestRoot<T>(
  source: T,
  container: Element,
  options?: RuntimeOptions,
): Root<T> {
  const adapter = new TestAdapter(container);
  const runtime = new Runtime(adapter, options);
  const part = createChildNodePart(
    container.ownerDocument.createComment(''),
    container.namespaceURI,
  );
  const slot = Slot.place(source, part, runtime);
  return new Root(slot, runtime);
}

export function createTestRuntime(
  container: Element = document.createElement('div'),
  options: RuntimeOptions & DOMAdapterOptions = {},
): Runtime<DOMPart, DOMRenderer> {
  return new Runtime(
    new TestAdapter(container, { defaultLanes: SyncLane, ...options }),
    options,
  );
}
