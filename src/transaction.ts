import type {
  Commit,
  Lanes,
  Reconciler,
  RenderNode,
  Scope,
  Transaction,
} from './abstractions.js';
import { isCommitted, isDetached, patch } from './commit.js';

export class UpdateComponent implements Transaction {
  private readonly _node: RenderNode.ComponentNode;
  private readonly _scope: Scope.Child;

  constructor(node: RenderNode.ComponentNode, scope: Scope.Child) {
    this._node = node;
    this._scope = scope;
  }

  get scope(): Scope {
    return this._scope;
  }

  get pendingLanes(): Lanes {
    return this._node.state.pendingLanes;
  }

  prepare(renderLanes: Lanes, reconciler: Reconciler): Commit {
    const node = this._node;
    if (isDetached(node)) {
      return noop;
    }

    const result = node.state.renderer.render(
      node,
      this._scope.parent,
      renderLanes,
    );
    const oldChild = node.children[0]!;
    const newChild = reconciler.diff(
      oldChild,
      result.element,
      0,
      node,
      result.scope,
      result.dirty,
    );

    node.state.pendingLanes &= ~renderLanes;

    return () => {
      if (isCommitted(node)) {
        patch(oldChild, newChild);
        node.state.renderer.afterCommit();
        node.children = [newChild];
      }
    };
  }
}

export function noop() {}
