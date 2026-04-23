import {
  createPortal,
  type RenderTree,
  Scope,
  type UpdateHandle,
  type UpdateOptions,
} from '../core.js';
import type { Runtime } from '../runtime.js';
import { mount, patch, unmount } from '../tree.js';

export class Root {
  private readonly _container: Element;
  private readonly _runtime: Runtime;
  private _root: RenderTree.NativeNode | null = null;

  constructor(container: Element, runtime: Runtime) {
    this._container = container;
    this._runtime = runtime;
  }

  render(child: unknown, options?: UpdateOptions): UpdateHandle {
    const scope = new Scope();
    return this._runtime.schedule(
      {
        scope,
        prepare: (reconciler) => {
          const element = createPortal(child, this._container);
          const newTree =
            this._root !== null
              ? (reconciler.diff(
                  this._root,
                  element,
                  scope,
                ) as RenderTree.NativeNode)
              : (reconciler.render(element, scope) as RenderTree.NativeNode);
          return () => {
            if (this._root !== null) {
              patch(this._root, newTree);
            } else {
              mount(newTree);
            }
            this._root = newTree;
          };
        },
      },
      options,
    );
  }

  unmount(options?: UpdateOptions): UpdateHandle {
    return this._runtime.schedule(
      {
        scope: new Scope(),
        prepare: () => {
          return () => {
            if (this._root !== null) {
              unmount(this._root);
              this._root = null;
            }
          };
        },
      },
      options,
    );
  }
}
