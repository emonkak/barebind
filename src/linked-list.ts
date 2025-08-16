interface OwnedNode<T> {
  value: T;
  prev: OwnedNode<T> | null;
  next: OwnedNode<T> | null;
  ownership: Symbol | null;
}

export namespace LinkedList {
  export interface Node<T> {
    readonly value: T;
    readonly prev: Node<T> | null;
    readonly next: Node<T> | null;
    readonly ownership: Symbol | null;
  }
}

export class LinkedList<T> implements Iterable<T> {
  private _head: OwnedNode<T> | null = null;

  private _tail: OwnedNode<T> | null = null;

  private readonly _ownership = Symbol('LinkedList.ownership');

  *[Symbol.iterator](): Generator<T> {
    for (let node = this._head; node !== null; node = node.next) {
      yield node.value;
    }
  }

  back(): LinkedList.Node<T> | null {
    return this._tail;
  }

  front(): LinkedList.Node<T> | null {
    return this._head;
  }

  isEmpty(): boolean {
    return this._head === null;
  }

  popBack(): LinkedList.Node<T> | null {
    const tail = this._tail;
    if (tail === null) {
      return null;
    }
    if (tail.prev !== null) {
      this._tail = tail.prev;
      this._tail.next = null;
      tail.prev = null;
    } else {
      this._head = null;
      this._tail = null;
    }
    tail.ownership = null;
    return tail;
  }

  popFront(): LinkedList.Node<T> | null {
    const head = this._head;
    if (head === null) {
      return null;
    }
    if (head.next !== null) {
      this._head = head.next;
      this._head.prev = null;
      head.next = null;
    } else {
      this._head = null;
      this._tail = null;
    }
    head.ownership = null;
    return head;
  }

  pushBack(value: T): LinkedList.Node<T> {
    const node = {
      value,
      prev: this._tail,
      next: null,
      ownership: this._ownership,
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

  pushFront(value: T): LinkedList.Node<T> {
    const node = {
      value,
      prev: null,
      next: this._head,
      ownership: this._ownership,
    };
    if (this._head !== null) {
      this._head.prev = node;
      this._head = node;
    } else {
      this._head = node;
      this._tail = node;
    }
    return node;
  }

  remove(node: LinkedList.Node<T>): boolean {
    if (!isOwnedNode(node, this._ownership)) {
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
    node.ownership = null;
    return true;
  }
}

function isOwnedNode<T>(
  node: LinkedList.Node<T>,
  ownership: Symbol,
): node is OwnedNode<T> {
  return node.ownership === ownership;
}
