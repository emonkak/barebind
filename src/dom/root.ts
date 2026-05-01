import {
  createPortal,
  type Dispatcher,
  Scope,
  type UpdateHandle,
  type UpdateOptions,
  type View,
} from '../core.js';
import { AllLanes } from '../lane.js';
import { mount, patch, unmount } from '../view.js';

export class Root {
  private readonly _container: Element;
  private readonly _dispatcher: Dispatcher;
  private _root: View.HostView | null = null;

  constructor(container: Element, dispatcher: Dispatcher) {
    this._container = container;
    this._dispatcher = dispatcher;
  }

  render(value: unknown, options?: UpdateOptions): UpdateHandle {
    const scope = new Scope();
    return this._dispatcher.schedule(
      {
        scope,
        pendingLanes: AllLanes,
        prepare: (_lanes, reconciler) => {
          const element = createPortal(value, this._container);
          const newRoot = (
            this._root !== null
              ? reconciler.diff(this._root, element, scope, 0, null)
              : reconciler.render(element, scope)
          ) as View.HostView;
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
        pendingLanes: AllLanes,
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
