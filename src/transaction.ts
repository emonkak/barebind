import type {
  Commit,
  Dispatcher,
  Lanes,
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

  prepare(dispatcher: Dispatcher): Commit {
    const node = this._node;
    if (isDetached(node)) {
      return noop;
    }

    node.state.txId = dispatcher.txId;

    const result = node.state.renderer.render(
      node,
      this._scope.parent,
      dispatcher.renderLanes,
    );
    const version = ++node.state.version;
    node.state.pendingLanes &= ~result.renderLanes;

    const oldChild = node.children[0]!;
    const newChild = dispatcher.diff(
      oldChild,
      result.element,
      0,
      node,
      result.scope,
      result.dirty,
    );

    if (!isCommitted(node)) {
      node.children = [newChild];
      return noop;
    }

    return () => {
      if (isCommitted(node) && node.state.version === version) {
        patch(oldChild, newChild);
        node.state.renderer.afterCommit();
        node.children = [newChild];
      }
    };
  }
}

export function noop() {}
