import {
  createPortal,
  type Dispatcher,
  type RenderTree,
  Scope,
  type UpdateHandle,
  type UpdateOptions,
} from '../core.js';
import { mount, patch, unmount } from '../tree.js';

export class Root {
  private readonly _container: Element;
  private readonly _dispatcher: Dispatcher;
  private _root: RenderTree.NativeNode | null = null;

  constructor(container: Element, dispatcher: Dispatcher) {
    this._container = container;
    this._dispatcher = dispatcher;
  }

  render(child: unknown, options?: UpdateOptions): UpdateHandle {
    const scope = new Scope();
    return this._dispatcher.schedule(
      {
        scope,
        prepare: (reconciler) => {
          const element = createPortal(child, this._container);
          const newRoot = (
            this._root !== null
              ? reconciler.diff(this._root, element, scope)
              : reconciler.render(element, scope)
          ) as RenderTree.NativeNode;
          return () => {
            if (this._root !== null) {
              patch(this._root, newRoot);
            } else {
              mount(newRoot);
            }
            this._root = newRoot;
          };
        },
      },
      options,
    );
  }

  unmount(options?: UpdateOptions): UpdateHandle {
    return this._dispatcher.schedule(
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
