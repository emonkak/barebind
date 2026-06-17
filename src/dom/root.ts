import { mount, patch, unmount } from '../commit.js';
import {
  type Dispatcher,
  type RenderRoot,
  Root,
  Scope,
  type UpdateHandle,
  type UpdateOptions,
  wrap,
} from '../core.js';
import { AllLanes } from '../lane.js';
import { PortalPart } from './part.js';

export class DOMRoot {
  private readonly _container: Element;
  private readonly _dispatcher: Dispatcher;
  private readonly _root: RenderRoot = { type: Root, current: null };

  constructor(container: Element, dispatcher: Dispatcher) {
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
          const scope = Scope.root();
          const root =
            this._root.current !== null
              ? renderer.diff(this._root.current, element, scope, 0, this._root)
              : renderer.render(
                  element,
                  scope,
                  0,
                  this._root,
                  new PortalPart(this._container),
                );
          return () => {
            if (this._root.current !== null) {
              patch(this._root.current, root);
            } else {
              mount(root);
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
            if (this._root.current !== null) {
              unmount(this._root.current);
              this._root.current = null;
            }
          };
        },
      },
      options,
    );
  }
}
