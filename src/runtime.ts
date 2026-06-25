import {
  type Commit,
  type Dispatcher,
  type HostAdapter,
  type Lanes,
  MUTATION_TYPE_INSERT,
  MUTATION_TYPE_REMOVE,
  MUTATION_TYPE_UPDATE,
  MUTATION_TYPE_UPDATE_AND_MOVE,
  type Part,
  type Renderer,
  type RenderNode,
  type RenderRoot,
  type Scope,
  type UpdateHandle,
  type UpdateOptions,
  type UpdateTransaction,
  type VElement,
  VNODE_KIND_BIND,
  VNODE_KIND_COMPONENT,
  VNODE_KIND_FRAGMENT,
  VNODE_KIND_PORTAL,
  VNODE_KIND_TEMPLATE,
} from './core.js';
import { assertUnreachable } from './debug.js';
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
  types: string[];
  transaction: UpdateTransaction;
  controller: PromiseWithResolvers<void>;
}

export class Runtime implements Renderer, Dispatcher {
  /** @internal */
  readonly _adapter: HostAdapter;
  /** @internal */
  readonly _updateQueue: PriorityQueue<Update> = new PriorityQueue(
    compareUpdates,
  );
  /** @internal */
  _updateBatch: Update[] = [];
  private _pendingLanes: number = NoLanes;
  private _stagedLanes: number = NoLanes;
  private _flushLanes: number = NoLanes;
  private _identifierCount: number = 0;
  private _transitionCount: number = 0;
  private _updateCount: number = 0;

  constructor(adapter: HostAdapter) {
    this._adapter = adapter;
  }

  diff(
    oldNode: RenderNode,
    newElement: VElement,
    scope: Scope,
    index: number,
    parent: RenderNode | RenderRoot,
  ): RenderNode {
    if (oldNode.type !== newElement.type || oldNode.key !== newElement.key) {
      return this.render(newElement, scope, index, parent, oldNode.part);
    }
    if (oldNode.props === newElement.props) {
      return oldNode;
    }
    switch (newElement.kind) {
      case VNODE_KIND_BIND: {
        return {
          ...(oldNode as RenderNode.BindNode),
          type: newElement.type,
          props: newElement.props,
          key: newElement.key,
          index,
          parent,
          dirty: true,
        };
      }
      case VNODE_KIND_COMPONENT: {
        if (
          ((oldNode as RenderNode.ComponentNode).state.handle.pendingLanes &
            this._flushLanes) ===
            NoLanes &&
          (oldNode as RenderNode.ComponentNode).type.arePropsEqual(
            oldNode.props,
            newElement.props,
          )
        ) {
          return oldNode;
        }
        const newNode: RenderNode.ComponentNode = {
          ...(oldNode as RenderNode.ComponentNode),
          type: newElement.type,
          props: newElement.props,
          key: newElement.key,
          index,
          parent,
          children: oldNode.children.slice(),
          dirty: true,
          state: {
            handle: (oldNode as RenderNode.ComponentNode).state.handle,
            scope,
          },
        };
        const subScope = scope.enter(newElement.type);
        newNode.children[0] = this.diff(
          newNode.children[0]!,
          newNode.state.handle.render(
            newNode.props,
            subScope,
            this._flushLanes,
          ),
          subScope,
          0,
          newNode,
        );
        return newNode;
      }
      case VNODE_KIND_FRAGMENT: {
        const newNode: RenderNode.FragmentNode = {
          ...(oldNode as RenderNode.FragmentNode),
          type: newElement.type,
          props: newElement.props,
          key: newElement.key,
          index,
          parent,
          children: new Array(newElement.children.length),
          dirty: true,
          state: { mutations: [] },
        };
        this._diffChildren(
          oldNode as RenderNode.FragmentNode,
          newNode,
          newElement.children,
          scope,
        );
        return newNode;
      }
      case VNODE_KIND_PORTAL:
      case VNODE_KIND_TEMPLATE: {
        const newNode: RenderNode.BlockNode = {
          ...(oldNode as RenderNode.BlockNode),
          type: newElement.type,
          props: newElement.props,
          key: newElement.key,
          index,
          parent,
          children: new Array(newElement.children.length),
        };
        for (let i = 0, l = newElement.children.length; i < l; i++) {
          const newChild = this.diff(
            oldNode.children[i]!,
            newElement.children[i]!,
            scope,
            i,
            newNode,
          );
          newNode.children[i] = newChild;
          newNode.dirty ||= newChild.dirty;
        }
        return newNode;
      }
      /** v8 ignore next @preserve */
      default:
        DEBUG: {
          assertUnreachable(newElement);
        }
    }
  }

  nextIdentifier(): string {
    return this._adapter.getIdentifier() + '-' + this._identifierCount++;
  }

  nextTransition(): number {
    return this._transitionCount++;
  }

  render(
    element: VElement,
    scope: Scope,
    index: number,
    parent: RenderNode | RenderRoot,
    part: Part,
  ): RenderNode {
    switch (element.kind) {
      case VNODE_KIND_BIND: {
        return {
          type: element.type,
          props: element.props,
          key: element.key,
          part,
          index,
          parent,
          children: [],
          dirty: true,
          state: null,
        };
      }
      case VNODE_KIND_COMPONENT: {
        const node: RenderNode.ComponentNode = {
          type: element.type,
          props: element.props,
          key: element.key,
          part,
          index,
          parent,
          children: new Array(1),
          dirty: true,
          state: {
            handle: element.type.createHandle(this),
            scope,
          },
        };
        const subScope = scope.enter(element.type);
        node.children[0] = this.render(
          node.state.handle.render(node.props, subScope, this._flushLanes),
          subScope,
          0,
          node,
          part,
        );
        return node;
      }
      case VNODE_KIND_FRAGMENT: {
        const node: RenderNode.FragmentNode = {
          type: element.type,
          props: element.props,
          key: element.key,
          part,
          index,
          parent,
          children: new Array(element.children.length),
          dirty: element.children.length > 0,
          state: { mutations: [] },
        };
        for (let i = 0, l = element.children.length; i < l; i++) {
          node.children[i] = this.render(
            element.children[i]!,
            scope,
            i,
            node,
            part.splitPart(),
          );
        }
        return node;
      }
      case VNODE_KIND_PORTAL: {
        const block = this._adapter.renderPortal(element);
        const node: RenderNode.BlockNode = {
          type: element.type,
          props: element.props,
          key: element.key,
          part,
          index,
          parent,
          children: new Array(1),
          dirty: true,
          state: { block },
        };
        node.children[0] = this.render(
          element.children[0],
          scope,
          0,
          node,
          block.parts[0]!,
        );
        return node;
      }
      case VNODE_KIND_TEMPLATE: {
        const block = this._adapter.renderTemplate(element);
        const node: RenderNode.BlockNode = {
          type: element.type,
          props: element.props,
          key: element.key,
          part,
          index,
          parent,
          children: new Array(element.children.length),
          dirty: true,
          state: { block },
        };
        for (let i = 0, l = element.children.length; i < l; i++) {
          node.children[i] = this.render(
            element.children[i]!,
            scope,
            i,
            node,
            block.parts[i]!,
          );
        }
        return node;
      }
      /** v8 ignore next @preserve */
      default:
        DEBUG: {
          assertUnreachable(element);
        }
    }
  }

  schedule(
    transaction: UpdateTransaction,
    options: UpdateOptions = {},
  ): UpdateHandle {
    const id = this._updateCount++;
    const lanes =
      getRenderLanes(options) ||
      getLaneFromPriority(this._adapter.getTaskPriority());
    const controller = Promise.withResolvers<void>();

    this._updateQueue.enqueue({
      id,
      lanes,
      types:
        typeof options.viewTransition === 'object'
          ? options.viewTransition
          : [],
      transaction,
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
    oldParent: RenderNode.FragmentNode,
    newParent: RenderNode.FragmentNode,
    newElements: VElement[],
    scope: Scope,
  ): void {
    const oldChildren: (RenderNode | undefined)[] = oldParent.children.slice();
    const newChildren = newParent.children;
    const oldKeys = oldChildren.map((child) => child!.key);
    const newKeys = newElements.map((element) => element.key);
    const { mutations } = newParent.state;

    let oldHead = 0;
    let newHead = 0;
    let oldTail = oldKeys.length - 1;
    let newTail = newKeys.length - 1;
    let oldKeyToIndexMap: Map<unknown, number> | undefined;
    let newKeyToIndexMap: Map<unknown, number> | undefined;

    while (true) {
      if (newHead > newTail) {
        while (oldHead <= oldTail) {
          const oldChild = oldChildren[oldHead];
          if (oldChild !== undefined) {
            mutations.push({
              type: MUTATION_TYPE_REMOVE,
              node: oldChild,
            });
          }
          oldHead++;
        }
        break;
      }
      if (oldHead > oldTail) {
        while (newHead <= newTail) {
          const newChild = this.render(
            newElements[newHead]!,
            scope,
            newHead,
            newParent,
            newParent.part.splitPart(),
          );
          mutations.push({
            type: MUTATION_TYPE_INSERT,
            node: newChild,
            afterNode: newChildren[newTail + 1],
          });
          newChildren[newHead] = newChild;
          newHead++;
        }
        break;
      }
      if (oldChildren[oldHead] === undefined) {
        oldHead++;
      } else if (oldChildren[oldTail] === undefined) {
        oldTail--;
      } else if (Object.is(oldKeys[oldHead]!, newKeys[newHead]!)) {
        const oldChild = oldChildren[oldHead]!;
        const newChild = this.diff(
          oldChild,
          newElements[newHead]!,
          scope,
          newHead,
          newParent,
        );
        mutations.push({
          type: MUTATION_TYPE_UPDATE,
          oldNode: oldChild,
          newNode: newChild,
          index: newHead,
        });
        newChildren[newHead] = newChild;
        oldHead++;
        newHead++;
      } else if (Object.is(oldKeys[oldTail]!, newKeys[newTail]!)) {
        const oldChild = oldChildren[oldTail]!;
        const newChild = this.diff(
          oldChild,
          newElements[newTail]!,
          scope,
          newTail,
          newParent,
        );
        mutations.push({
          type: MUTATION_TYPE_UPDATE,
          oldNode: oldChild,
          newNode: newChild,
          index: newTail,
        });
        newChildren[newTail] = newChild;
        oldTail--;
        newTail--;
      } else if (
        Object.is(oldKeys[oldHead]!, newKeys[newTail]!) &&
        Object.is(oldKeys[oldTail]!, newKeys[newHead]!)
      ) {
        const tailChild = this.diff(
          oldChildren[oldTail]!,
          newElements[newHead]!,
          scope,
          newHead,
          newParent,
        );
        const headChild = this.diff(
          oldChildren[oldHead]!,
          newElements[newTail]!,
          scope,
          newTail,
          newParent,
        );
        mutations.push({
          type: MUTATION_TYPE_UPDATE_AND_MOVE,
          oldNode: oldChildren[oldTail]!,
          newNode: tailChild,
          afterNode: oldChildren[oldHead],
          index: newHead,
        });
        mutations.push({
          type: MUTATION_TYPE_UPDATE_AND_MOVE,
          oldNode: oldChildren[oldHead]!,
          newNode: headChild,
          afterNode: newChildren[newTail + 1],
          index: newTail,
        });
        newChildren[newHead] = tailChild;
        newChildren[newTail] = headChild;
        oldHead++;
        newHead++;
        oldTail--;
        newTail--;
      } else {
        newKeyToIndexMap ??= buildKeyToIndexMap(newKeys, newHead, newTail);

        if (!newKeyToIndexMap.has(oldKeys[oldHead]!)) {
          const oldChild = oldChildren[oldHead]!;
          mutations.push({
            type: MUTATION_TYPE_REMOVE,
            node: oldChild,
          });
          oldHead++;
        } else if (!newKeyToIndexMap.has(oldKeys[oldTail]!)) {
          const oldChild = oldChildren[oldTail]!;
          mutations.push({
            type: MUTATION_TYPE_REMOVE,
            node: oldChild,
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
            const newChild = this.diff(
              oldChildren[oldIndex]!,
              newElements[newTail]!,
              scope,
              newTail,
              newParent,
            );
            mutations.push({
              type: MUTATION_TYPE_UPDATE_AND_MOVE,
              oldNode: oldChildren[oldIndex]!,
              newNode: newChild,
              afterNode: newChildren[newTail + 1],
              index: newTail,
            });
            newChildren[newTail] = newChild;
            oldChildren[oldIndex] = undefined;
          } else {
            const newChild = this.render(
              newElements[newTail]!,
              scope,
              newTail,
              newParent,
              newParent.part.splitPart(),
            );
            mutations.push({
              type: MUTATION_TYPE_INSERT,
              node: newChild,
              afterNode: newChildren[newTail + 1],
            });
            newChildren[newTail] = newChild;
          }

          newTail--;
        }
      }
    }
  }

  private async _flush(): Promise<void> {
    while (true) {
      let update: Update | undefined;

      this._flushLanes |= this._stagedLanes;
      this._stagedLanes = NoLanes;

      while ((update = this._updateQueue.peek()) !== undefined) {
        if (
          (update.lanes & this._flushLanes) !== update.lanes &&
          getHighestPriorityLane(this._flushLanes) <
            getHighestPriorityLane(update.lanes)
        ) {
          break;
        }
        this._flushLanes |= update.lanes;
        this._updateBatch.push(this._updateQueue.dequeue()!);
      }

      if (this._updateBatch.length === 0) {
        break;
      }

      try {
        const commitBatch: Commit[] = [];

        for (const update of this._updateBatch) {
          const { lanes, transaction } = update;
          if ((transaction.pendingLanes & lanes) === NoLanes) {
            continue;
          }
          commitBatch.push(transaction.prepare(this._flushLanes, this));
        }

        if (commitBatch.length > 0) {
          const callback = () => {
            for (const commit of commitBatch) {
              commit();
            }
          };
          if ((this._flushLanes & SyncLane) === SyncLane) {
            callback();
          } else if (this._flushLanes & ViewTransitionLane) {
            await this._adapter.startViewTransition(
              callback,
              this._updateBatch.flatMap((update) => update.types),
            );
          } else {
            await this._adapter.requestCommit(callback);
          }
        }

        for (const { controller } of this._updateBatch) {
          controller.resolve();
        }
      } catch (error) {
        for (const { controller } of this._updateBatch) {
          controller.reject(error);
        }
      } finally {
        this._updateBatch = [];
      }
    }

    this._flushLanes = NoLanes;
  }
}

export async function waitForStep(runtime: Runtime): Promise<boolean> {
  if (runtime._updateBatch.length > 0) {
    for (const update of runtime._updateBatch) {
      await update.controller.promise;
    }
    return true;
  } else {
    const update = runtime._updateQueue.peek();
    if (update !== undefined) {
      await update.controller.promise;
      return true;
    }
    return false;
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
  const highestLane1 = getHighestPriorityLane(update1.lanes);
  const highestLane2 = getHighestPriorityLane(update2.lanes);
  return highestLane1 !== highestLane2
    ? highestLane1 - highestLane2
    : update1.transaction.level - update2.transaction.level;
}
