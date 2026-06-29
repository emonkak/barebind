import { mount, patch, unmount } from '../commit.js';
import {
  type Container,
  type Dispatcher,
  type RenderRoot,
  Root,
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
    type: Root,
    children: [undefined],
  };

  constructor(container: Container, dispatcher: Dispatcher) {
    this._container = container;
    this._dispatcher = dispatcher;
  }

  render(value: unknown, options?: UpdateOptions): UpdateHandle {
    return this._dispatcher.schedule(
      {
        level: 0,
        pendingLanes: AllLanes,
        prepare: (_lanes, renderer) => {
          const element = wrap(value);
          const scope = Scope.root(this);
          const oldChild = this._root.children[0];
          const newChild =
            oldChild !== undefined
              ? renderer.diff(oldChild, element, scope, 0, this._root)
              : renderer.render(
                  element,
                  scope,
                  0,
                  this._root,
                  new ContainerPart(this._container),
                );
          return () => {
            const oldChild = this._root.children[0];
            if (oldChild !== undefined) {
              patch(oldChild, newChild);
            } else {
              mount(newChild);
            }
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
        prepare: () => {
          return () => {
            const child = this._root.children[0];
            if (child !== undefined) {
              unmount(child);
              this._root.children[0] = undefined;
            }
          };
        },
      },
      options,
    );
  }
}
