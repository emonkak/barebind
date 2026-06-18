import { createPortal, type RenderRoot } from '../core.js';
import { mount, Runtime, unmount, update } from '../runtime.js';
import { DOMAdapter } from './adapter.js';

export class Root {
  private readonly _container: Element;
  private readonly _runtime: Runtime;
  private _tree: RenderRoot | null = null;

  constructor(container: Element, runtime: Runtime) {
    this._container = container;
    this._runtime = runtime;
  }

  render(child: unknown): void {
    const oldTree = this._tree;
    const element = createPortal(child, this._container);

    if (oldTree !== null) {
      const newTree = this._runtime.diff(oldTree, element);
      update(oldTree, newTree);
    } else {
      const tree = this._runtime.render(element);
      mount(tree);
    }
  }

  unmount(): void {
    if (this._tree !== null) {
      unmount(this._tree);
    }
  }
}

export function createRoot(container: Element): Root {
  const runtime = new Runtime(new DOMAdapter());
  return new Root(container, runtime);
}
