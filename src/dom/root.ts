import {
  createPortal,
  type RenderRoot,
  Scope,
  type UpdateHandle,
  type UpdateOptions,
} from '../core.js';
import type { Runtime } from '../runtime.js';
import { mount, patch, unmount } from '../tree.js';

export class Root {
  private readonly _container: Element;
  private readonly _runtime: Runtime;
  private _tree: RenderRoot | null = null;

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
            this._tree !== null
              ? reconciler.diff(this._tree, element, scope)
              : reconciler.render(element, scope);
          return () => {
            if (this._tree !== null) {
              patch(this._tree, newTree);
            } else {
              mount(newTree);
            }
            this._tree = newTree;
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
            if (this._tree !== null) {
              unmount(this._tree);
              this._tree = null;
            }
          };
        },
      },
      options,
    );
  }
}
