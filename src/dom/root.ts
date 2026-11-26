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
  private _root: RenderNode | null = null;

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
          const oldRoot = this._root;
          const newRoot =
            oldRoot !== null
              ? reconciler.diff(oldRoot, element, 0, null, scope, false)
              : reconciler.build(
                  element,
                  0,
                  null,
                  scope,
                  new ContainerPart(this._container),
                );
          return () => {
            if (oldRoot !== null) {
              patch(oldRoot, newRoot);
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
    const scope = createScope(this);
    return this._dispatcher.schedule(
      {
        scope,
        pendingLanes: Lane.AllLanes,
        prepare: () => {
          const root = this._root;
          this._root = null;
          return () => {
            if (root !== null) {
              unmount(root);
            }
          };
        },
      },
      options,
    );
  }
}
