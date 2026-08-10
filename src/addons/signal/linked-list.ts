export namespace LinkedList {
  export interface Node<T> {
    readonly value: T;
    readonly prev: Node<T> | null;
    readonly next: Node<T> | null;
    readonly owner: LinkedList<T> | null;
  }
}

interface InternalNode<T> {
  value: T;
  prev: InternalNode<T> | null;
  next: InternalNode<T> | null;
  owner: LinkedList<T> | null;
}

export class LinkedList<T> implements Iterable<T> {
  private _head: InternalNode<T> | null = null;
  private _tail: InternalNode<T> | null = null;

  *[Symbol.iterator](): Generator<T> {
    for (let node = this._head; node !== null; node = node.next) {
      yield node.value;
    }
  }

  append(value: T): LinkedList.Node<T> {
    const node: InternalNode<T> = {
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

  delete(node: LinkedList.Node<T>): boolean {
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
  node: LinkedList.Node<T>,
  owner: LinkedList<T>,
): node is InternalNode<T> {
  return node.owner === owner;
}
