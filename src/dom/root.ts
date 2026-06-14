import {
  createPortal,
  type Dispatcher,
  type RenderNode,
  Scope,
  type UpdateHandle,
  type UpdateOptions,
} from '../core.js';
import { AllLanes } from '../lane.js';
import { mount, patch, unmount } from '../tree.js';

export class Root {
  private readonly _container: Element;
  private readonly _dispatcher: Dispatcher;
  private _root: RenderNode.NativeNode | null = null;

  constructor(container: Element, dispatcher: Dispatcher) {
    this._container = container;
    this._dispatcher = dispatcher;
  }

  render(value: unknown, options?: UpdateOptions): UpdateHandle {
    return this._dispatcher.schedule(
      {
        level: 0,
        pendingLanes: AllLanes,
        produce: (_lanes, reconciler) => {
          const element = createPortal(value, this._container);
          const scope = Scope.root();
          const newRoot = (
            this._root !== null
              ? reconciler.diff(this._root, element, scope, 0, null)
              : reconciler.render(element, scope)
          ) as RenderNode.NativeNode;
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
        level: 0,
        pendingLanes: AllLanes,
        produce: () => {
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
