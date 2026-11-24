import type {
  Commit,
  Lanes,
  Reconciler,
  RenderNode,
  Scope,
  Transaction,
} from '../abstractions.js';
import { patch } from '../commit.js';

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

  prepare(reconciler: Reconciler, renderLanes: Lanes): Commit {
    if (this._node.index < 0) {
      return noop;
    }

    const result = this._node.state.renderer.render(
      this._node,
      this._scope.parent,
      renderLanes,
    );
    let newNode: RenderNode;
    let commit: Commit;

    if (this._node.right[0] === undefined) {
      // Reached when a re-render occurs during the initial render. The
      // parent always commits in that case, and the node may also be
      // invalidated by later updates, so do nothing.
      newNode = reconciler.build(
        result.element,
        0,
        this._node,
        result.scope,
        this._node.part,
      );
      commit = noop;
    } else {
      newNode = reconciler.diff(
        this._node.right[0],
        result.element,
        0,
        this._node,
        result.scope,
        result.dirty,
      );
      commit = () => {
        if (this._node.index >= 0) {
          patch(this._node.right[0]!, this._node.left[0]!);
          this._node.state.renderer.afterCommit();
          this._node.right = this._node.left;
        }
      };
    }

    this._node.left = [newNode];
    this._node.state.pendingLanes &= ~renderLanes;

    return commit;
  }
}

function noop() {}
