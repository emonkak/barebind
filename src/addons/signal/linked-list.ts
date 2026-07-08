export namespace LinkedList {
  export interface ImmutableNode<T> {
    readonly value: T;
    readonly prev: ImmutableNode<T> | null;
    readonly next: ImmutableNode<T> | null;
    readonly owner: LinkedList<T> | null;
  }

  export interface MutableNode<T> {
    value: T;
    prev: MutableNode<T> | null;
    next: MutableNode<T> | null;
    owner: LinkedList<T> | null;
  }
}

export class LinkedList<T> implements Iterable<T> {
  private _head: LinkedList.MutableNode<T> | null = null;
  private _tail: LinkedList.MutableNode<T> | null = null;

  *[Symbol.iterator](): Generator<T> {
    for (let node = this._head; node !== null; node = node.next) {
      yield node.value;
    }
  }

  push(value: T): LinkedList.ImmutableNode<T> {
    const node: LinkedList.MutableNode<T> = {
      value,
      prev: this._tail,
      next: null,
      owner: this,
    };
    if (this._tail !== null) {
      this._tail.next = node;
      this._tail = node;
    } else {
      this._head = node;
      this._tail = node;
    }
    return node;
  }

  delete(node: LinkedList.ImmutableNode<T>): boolean {
    if (!isNodeOwned(node, this)) {
      return false;
    }
    const { prev, next } = node;
    if (prev !== null) {
      prev.next = next;
    } else {
      this._head = next;
    }
    if (next !== null) {
      next.prev = prev;
    } else {
      this._tail = prev;
    }
    node.owner = null;
    return true;
  }
}

function isNodeOwned<T>(
  node: LinkedList.ImmutableNode<T>,
  owner: LinkedList<T>,
): node is LinkedList.MutableNode<T> {
  return node.owner === owner;
}
