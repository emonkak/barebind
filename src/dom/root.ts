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
import { noop } from '../unit-of-work.js';
import { wrap } from '../vnode.js';
import { ContainerPart } from './part.js';

export class DOMRoot {
  private readonly _dispatcher: Dispatcher;
  private readonly _container: HostContainer;
  private _root: RenderNode | null = null;
  private _version: number = 0;

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
        prepare: (reconciler) => {
          const element = wrap(value);
          const oldRoot = this._root;
          const version = ++this._version;
          if (oldRoot !== null) {
            const newRoot = reconciler.diff(
              oldRoot,
              element,
              0,
              null,
              scope,
              false,
            );
            return () => {
              if (this._version === version) {
                patch(oldRoot, newRoot);
                this._root = newRoot;
              }
            };
          } else {
            const newRoot = reconciler.build(
              element,
              0,
              null,
              scope,
              new ContainerPart(this._container),
            );
            return () => {
              if (this._version === version) {
                mount(newRoot);
                this._root = newRoot;
              }
            };
          }
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
          const version = ++this._version;
          return root !== null
            ? () => {
                if (this._version === version) {
                  unmount(root);
                  this._root = null;
                }
              }
            : noop;
        },
      },
      options,
    );
  }
}
