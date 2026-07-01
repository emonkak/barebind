import { mount, patch, unmount } from '../commit.js';
import {
  type Container,
  type Dispatcher,
  type RenderRoot,
  Scope,
  type UpdateHandle,
  type UpdateOptions,
  wrap,
} from '../core.js';
import { AllLanes } from '../lane.js';
import { ContainerPart } from './part.js';

export class DOMRoot {
  private readonly _container: Container;
  private readonly _dispatcher: Dispatcher;
  private readonly _root: RenderRoot = {
    type: null,
    left: null,
    right: null,
  };

  constructor(container: Container, dispatcher: Dispatcher) {
    this._container = container;
    this._dispatcher = dispatcher;
  }

  render(value: unknown, options?: UpdateOptions): UpdateHandle {
    const scope = Scope.root(this);
    return this._dispatcher.schedule(
      {
        scope,
        pendingLanes: AllLanes,
        prepare: (_lanes, renderer) => {
          const element = wrap(value);
          this._root.left =
            this._root.right !== null
              ? renderer.diff(this._root.right, element, scope, 0, this._root)
              : renderer.render(
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
