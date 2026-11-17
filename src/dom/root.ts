import {
  type Dispatcher,
  type HostContainer,
  type RenderRoot,
  Scope,
  type UpdateHandle,
  type UpdateOptions,
} from '../base.js';
import { mount, patch, unmount } from '../commit.js';
import { AllLanes } from '../lane.js';
import { wrap } from '../velement.js';
import { ContainerPart } from './part.js';

export class DOMRoot {
  private readonly _dispatcher: Dispatcher;
  private readonly _container: HostContainer;
  private readonly _root: RenderRoot = {
    type: null,
    left: null,
    right: null,
  };

  constructor(dispatcher: Dispatcher, container: HostContainer) {
    this._dispatcher = dispatcher;
    this._container = container;
  }

  render(value: unknown, options?: UpdateOptions): UpdateHandle {
    const scope = Scope.root(this);
    return this._dispatcher.schedule(
      {
        scope,
        pendingLanes: AllLanes,
        prepare: (_lanes, reconciler) => {
          const element = wrap(value);
          this._root.left =
            this._root.right !== null
              ? reconciler.diff(this._root.right, element, scope, 0, this._root)
              : reconciler.build(
                  element,
                  scope,
                  0,
                  this._root,
                  new ContainerPart(this._container),
                );
          return () => {
            if (this._root.right !== null) {
              patch(this._root.right, this._root.left!);
            } else {
              mount(this._root.left!);
            }
            this._root.right = this._root.left;
          };
        },
      },
      options,
    );
  }

  unmount(options?: UpdateOptions): UpdateHandle {
    const scope = Scope.root(this);
    return this._dispatcher.schedule(
      {
        scope,
        pendingLanes: AllLanes,
        prepare: () => {
          return () => {
            if (this._root.right !== null) {
              unmount(this._root.right);
              this._root.right = null;
            }
          };
        },
      },
      options,
    );
  }
}
