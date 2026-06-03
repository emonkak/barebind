import { areDependenciesChange } from './compare.js';
import {
  Directive,
  type Dispatcher,
  type Effect,
  Fragment,
  type HostAdapter,
  InsertType,
  type Lanes,
  type Mutation,
  type Reconciler,
  RemoveType,
  type Scope,
  UpdateAndMoveType,
  type UpdateHandle,
  type UpdateOptions,
  UpdateType,
  type UpdateUnit,
  type VElement,
  type View,
} from './core.js';
import {
  getHighestPriorityLane,
  getLaneFromPriority,
  getPriorityFromLanes,
  getRenderLanes,
  NoLanes,
  SyncLane,
  ViewTransitionLane,
} from './lane.js';
import { PriorityQueue } from './queue.js';

interface Update {
  id: number;
  lanes: Lanes;
  unit: UpdateUnit;
  controller: PromiseWithResolvers<void>;
}

export class Runtime implements Reconciler, Dispatcher {
  /** @internal */
  readonly _adapter: HostAdapter;
  /** @internal */
  readonly _updateQueue: PriorityQueue<Update> = new PriorityQueue(
    compareUpdates,
  );
  private _pendingLanes: number = NoLanes;
  private _stagedLanes: number = NoLanes;
  private _flushLanes: number = NoLanes;
  private _identifierCount: number = 0;
  private _renderCount: number = 0;
  private _transitionCount: number = 0;
  private _updateCount: number = 0;

  constructor(renderer: HostAdapter) {
    this._adapter = renderer;
  }

  get flushLanes(): Lanes {
    return this._flushLanes;
  }

  diff(
    oldView: View,
    newElement: VElement,
    scope: Scope,
    index: number,
    parent: View | null,
  ): View {
    if (oldView.type !== newElement.type || oldView.key !== newElement.key) {
      return this.render(newElement, scope, index, parent);
    } else if (oldView.props === newElement.props) {
      return { ...oldView, index, parent };
    } else if (typeof newElement.type === 'function') {
      const newView: View.ComponentView = {
        ...(oldView as View.ComponentView),
        ...newElement,
        id: this._renderCount++,
        index,
        parent,
        children: oldView.children.slice(),
      };
      if (
        (oldView as View.ComponentView).data.prepareRender(
          oldView as View.ComponentView,
          newElement,
          this._flushLanes,
        )
      ) {
        const subScope = scope.child();
        newView.children[0] = this.diff(
          newView.children[0]!,
          newView.data.render(newView, subScope, this._flushLanes),
          subScope,
          0,
          newView,
        );
      }
      return newView;
    } else if (newElement.type === Directive) {
      const newView: View.DirectiveView = {
        ...(oldView as View.DirectiveView),
        ...newElement,
        id: this._renderCount++,
        index,
        parent,
      };
      newView.data.dirty = areDependenciesChange(
        (oldView as View.DirectiveView).props.deps,
        newElement.props.deps,
      );
      return newView;
    } else if (newElement.type === Fragment) {
      const newView: View.FragmentView = {
        ...(oldView as View.FragmentView),
        ...newElement,
        id: this._renderCount++,
        index,
        parent,
        children: new Array(newElement.children.length),
        data: [],
      };
      this._diffChildren(
        (oldView as View.FragmentView).children.slice(),
        newView.children,
        newElement.children,
        scope,
        newView,
        newView.data,
      );
      return newView;
    } else {
      const newView: View.HostView = {
        ...(oldView as View.HostView),
        ...newElement,
        id: this._renderCount++,
        index,
        parent,
        children: new Array(newElement.children.length),
      };
      for (let i = 0, l = newElement.children.length; i < l; i++) {
        newView.children[i] = this.diff(
          oldView.children[i]!,
          newElement.children[i]!,
          scope,
          i,
          newView,
        );
      }
      return newView;
    }
  }

  nextIdentifier(): string {
    return this._adapter.getIdentifier() + '-' + this._identifierCount++;
  }

  nextRenderId(): number {
    return this._renderCount++;
  }

  nextTransition(): number {
    return this._transitionCount++;
  }

  render(
    element: VElement,
    scope: Scope,
    index: number = 0,
    parent: View | null = null,
  ): View {
    if (typeof element.type === 'function') {
      const view: View.ComponentView = {
        ...element,
        id: this._renderCount++,
        index,
        parent,
        children: new Array(1),
        data: element.type.newInstance(this),
      };
      const subScope = scope.child();
      view.children[0] = this.render(
        view.data.render(view, subScope, this._flushLanes),
        subScope,
        0,
        view,
      );
      return view;
    } else if (element.type === Directive) {
      return {
        ...element,
        id: this._renderCount++,
        index,
        parent,
        children: [],
        data: {
          dirty: true,
          cleanup: undefined,
        },
      };
    } else if (element.type === Fragment) {
      const view: View.FragmentView = {
        ...element,
        id: this._renderCount++,
        index,
        parent,
        children: new Array(element.children.length),
        data: [],
      };
      for (let i = 0, l = element.children.length; i < l; i++) {
        view.children[i] = this.render(element.children[i]!, scope, i, view);
      }
      return view;
    } else {
      const view: View.HostView = {
        ...element,
        id: this._renderCount++,
        index,
        parent,
        children: new Array(element.children.length),
        data: this._adapter.createHostNode(element),
      };
      for (let i = 0, l = element.children.length; i < l; i++) {
        view.children[i] = this.render(element.children[i]!, scope, i, view);
      }
      return view;
    }
  }

  schedule(unit: UpdateUnit, options: UpdateOptions = {}): UpdateHandle {
    const controller = Promise.withResolvers<void>();
    const id = this._updateCount++;
    const lanes =
      getRenderLanes(options) ||
      getLaneFromPriority(this._adapter.getTaskPriority());

    this._updateQueue.enqueue({
      id,
      lanes,
      unit,
      controller,
    });

    if (((this._pendingLanes | this._stagedLanes) & lanes) !== lanes) {
      const priority = getPriorityFromLanes(lanes);
      this._pendingLanes |= lanes;
      this._adapter.requestCallback(
        () => {
          this._pendingLanes &= ~lanes;
          this._stagedLanes |= lanes;
          if (this._flushLanes === NoLanes) {
            this._flush();
          }
        },
        { ...options, priority },
      );
    }

    return {
      id,
      lanes,
      finished: controller.promise,
    };
  }

  private _diffChildren(
    oldChildren: (View | undefined)[],
    newChildren: View[],
    newElements: VElement[],
    scope: Scope,
    parent: View,
    mutations: Mutation[],
  ): void {
    const oldKeys = oldChildren.map((node) => node!.key);
    const newKeys = newElements.map((element) => element.key);

    let oldHead = 0;
    let newHead = 0;
    let oldTail = oldKeys.length - 1;
    let newTail = newKeys.length - 1;
    let oldKeyToIndexMap: Map<unknown, number> | undefined;
    let newKeyToIndexMap: Map<unknown, number> | undefined;

    while (true) {
      if (newHead > newTail) {
        while (oldHead <= oldTail) {
          const view = oldChildren[oldHead];
          if (view !== undefined) {
            mutations.push({
              type: RemoveType,
              view,
            });
          }
          oldHead++;
        }
        break;
      }
      if (oldHead > oldTail) {
        while (newHead <= newTail) {
          const view = this.render(
            newElements[newHead]!,
            scope,
            newHead,
            parent,
          );
          mutations.push({
            type: InsertType,
            view,
            afterView: newChildren[newTail + 1],
          });
          newChildren[newHead] = view;
          newHead++;
        }
        break;
      }
      if (oldChildren[oldHead] === undefined) {
        oldHead++;
      } else if (oldChildren[oldTail] === undefined) {
        oldTail--;
      } else if (Object.is(oldKeys[oldHead]!, newKeys[newHead]!)) {
        const newView = this.diff(
          oldChildren[oldHead]!,
          newElements[newHead]!,
          scope,
          newHead,
          parent,
        );
        mutations.push({
          type: UpdateType,
          oldView: oldChildren[oldHead]!,
          newView,
        });
        newChildren[newHead] = newView;
        oldHead++;
        newHead++;
      } else if (Object.is(oldKeys[oldTail]!, newKeys[newTail]!)) {
        const newView = this.diff(
          oldChildren[oldTail]!,
          newElements[newTail]!,
          scope,
          newTail,
          parent,
        );
        mutations.push({
          type: UpdateType,
          oldView: oldChildren[oldTail]!,
          newView,
        });
        newChildren[newTail] = newView;
        oldTail--;
        newTail--;
      } else if (
        Object.is(oldKeys[oldHead]!, newKeys[newTail]!) &&
        Object.is(oldKeys[oldTail]!, newKeys[newHead]!)
      ) {
        const tailView = this.diff(
          oldChildren[oldTail]!,
          newElements[newHead]!,
          scope,
          newHead,
          parent,
        );
        const headView = this.diff(
          oldChildren[oldHead]!,
          newElements[newTail]!,
          scope,
          newTail,
          parent,
        );
        mutations.push({
          type: UpdateAndMoveType,
          oldView: oldChildren[oldTail]!,
          newView: tailView,
          afterView: oldChildren[oldHead],
        });
        mutations.push({
          type: UpdateAndMoveType,
          oldView: oldChildren[oldHead]!,
          newView: headView,
          afterView: newChildren[newTail + 1],
        });
        newChildren[newHead] = tailView;
        newChildren[newTail] = headView;
        oldHead++;
        newHead++;
        oldTail--;
        newTail--;
      } else {
        newKeyToIndexMap ??= buildKeyToIndexMap(newKeys, newHead, newTail);

        if (!newKeyToIndexMap.has(oldKeys[oldHead]!)) {
          mutations.push({
            type: RemoveType,
            view: oldChildren[oldHead]!,
          });
          oldHead++;
        } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
          mutations.push({
            type: RemoveType,
            view: oldChildren[oldTail]!,
          });
          oldTail--;
        } else {
          oldKeyToIndexMap ??= buildKeyToIndexMap(oldKeys, oldHead, oldTail);
          const oldIndex = oldKeyToIndexMap.get(newKeys[newTail]!);

          if (
            oldIndex !== undefined &&
            oldIndex >= oldHead &&
            oldIndex <= oldTail &&
            oldChildren[oldIndex] !== undefined
          ) {
            const newView = this.diff(
              oldChildren[oldIndex]!,
              newElements[newTail]!,
              scope,
              newTail,
              parent,
            );
            mutations.push({
              type: UpdateAndMoveType,
              oldView: oldChildren[oldIndex]!,
              newView,
              afterView: newChildren[newTail + 1],
            });
            newChildren[newTail] = newView;
            oldChildren[oldIndex] = undefined;
          } else {
            const view = this.render(
              newElements[newTail]!,
              scope,
              newTail,
              parent,
            );
            mutations.push({
              type: InsertType,
              view,
              afterView: newChildren[newTail + 1],
            });
            newChildren[newTail] = view;
          }

          newTail--;
        }
      }
    }
  }

  private async _flush(): Promise<void> {
    while (true) {
      const updateBatch: Update[] = [];
      let update: Update | undefined;

      this._flushLanes |= this._stagedLanes;
      this._stagedLanes = NoLanes;

      while ((update = this._updateQueue.peek()) !== undefined) {
        if ((this._flushLanes & update.lanes) !== update.lanes) {
          break;
        }
        updateBatch.push(this._updateQueue.dequeue()!);
      }

      if (updateBatch.length === 0) {
        break;
      }

      try {
        const effectBatch: Effect[] = [];
        const flushSync = (this._flushLanes & SyncLane) === SyncLane;

        for (const update of updateBatch) {
          const { lanes, unit } = update;

          if ((unit.pendingLanes & lanes) === NoLanes) {
            continue;
          }

          if (!flushSync && effectBatch.length > 0) {
            await this._adapter.yieldToMain();
          }

          effectBatch.push(unit.prepare(this._flushLanes, this));
        }

        if (effectBatch.length > 0) {
          const commit = () => {
            for (const effect of effectBatch) {
              effect();
            }
          };
          if (flushSync) {
            commit();
          } else if (this._flushLanes & ViewTransitionLane) {
            await this._adapter.startViewTransition(commit);
          } else {
            await this._adapter.requestCommit(commit);
          }
        }

        for (const { controller } of updateBatch) {
          controller.resolve();
        }
      } catch (error) {
        for (const { controller } of updateBatch) {
          controller.reject(error);
        }
      }
    }

    this._flushLanes = NoLanes;
  }
}

export async function waitForIdle(runtime: Runtime): Promise<void> {
  while (true) {
    const update = runtime._updateQueue.peek();
    if (update === undefined) {
      break;
    }
    await update.controller.promise;
  }
}

function buildKeyToIndexMap<T>(
  keys: T[],
  head: number,
  tail: number,
): Map<T, number> {
  const keyToIndexMap = new Map();
  for (let i = head; i <= tail; i++) {
    keyToIndexMap.set(keys[i]!, i);
  }
  return keyToIndexMap;
}

function compareUpdates(update1: Update, update2: Update): number {
  const lane1 = getHighestPriorityLane(update1.lanes);
  const lane2 = getHighestPriorityLane(update2.lanes);
  const level1 = update1.unit.scope.level;
  const level2 = update2.unit.scope.level;
  return lane1 !== lane2 ? lane1 - lane2 : level1 - level2;
}
