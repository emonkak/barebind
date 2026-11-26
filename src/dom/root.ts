import type {
  Dispatcher,
  HostContainer,
  RenderNode,
  UpdateHandle,
  UpdateOptions,
} from '../abstractions.js';
import { mount, patch, unmount } from '../commit.js';
import { Lane } from '../lane.js';
import { createScope } from '../scope.js';
import { wrap } from '../vnode.js';
import { ContainerPart } from './part.js';

export class DOMRoot {
  private readonly _dispatcher: Dispatcher;
  private readonly _container: HostContainer;
  private _left: RenderNode | null = null;
  private _right: RenderNode | null = null;

  constructor(dispatcher: Dispatcher, container: HostContainer) {
    this._dispatcher = dispatcher;
    this._container = container;
  }

  render(value: unknown, options?: UpdateOptions): UpdateHandle {
    const scope = createScope(this);
    return this._dispatcher.schedule(
      {
        scope,
        pendingLanes: Lane.AllLanes,
        prepare: (_renderLanes, reconciler) => {
          const element = wrap(value);
          this._left =
            this._right !== null
              ? reconciler.diff(this._right, element, 0, null, scope, false)
              : reconciler.build(
                  element,
                  0,
                  null,
                  scope,
                  new ContainerPart(this._container),
                );
          return () => {
            if (this._right !== null) {
              patch(this._right, this._left!);
            } else {
              mount(this._left!);
            }
            this._right = this._left;
          };
        },
      },
      options,
    );
  }

  unmount(options?: UpdateOptions): UpdateHandle {
    const scope = createScope(this);
    return this._dispatcher.schedule(
      {
        scope,
        pendingLanes: Lane.AllLanes,
        prepare: () => {
          return () => {
            if (this._right !== null) {
              unmount(this._right);
              this._right = null;
            }
          };
        },
      },
      options,
    );
  }
}
