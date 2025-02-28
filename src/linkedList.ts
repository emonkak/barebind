export namespace LinkedList {
  export interface Node<T> {
    readonly value: T;
    readonly prev: Node<T> | null;
    readonly next: Node<T> | null;
    readonly owner: LinkedList<T> | null;
  }

  export interface MutableNode<T> {
    value: T;
    prev: MutableNode<T> | null;
    next: MutableNode<T> | null;
    owner: LinkedList<T> | null;
  }
}

type Node<T> = LinkedList.Node<T>;

type MutableNode<T> = LinkedList.MutableNode<T>;

export class LinkedList<T> implements Iterable<T> {
  private _head: MutableNode<T> | null = null;

  private _tail: MutableNode<T> | null = null;

  *[Symbol.iterator](): Iterator<T> {
    for (let node = this._head; node !== null; node = node.next) {
      yield node.value;
    }
  }

  back(): Node<T> | null {
    return this._tail;
  }

  front(): Node<T> | null {
    return this._head;
  }

  isEmpty(): boolean {
    return this._head === null;
  }

  popBack(): Node<T> | null {
    const tail = this._tail;

    if (tail !== null) {
      if (tail.prev !== null) {
        this._tail = tail.prev;
        this._tail.next = null;
        tail.prev = null;
      } else {
        this._head = null;
        this._tail = null;
      }
      tail.owner = null;
    }

    return tail;
  }

  popFront(): Node<T> | null {
    const head = this._head;

    if (head !== null) {
      if (head.next !== null) {
        this._head = head.next;
        this._head.prev = null;
        head.next = null;
      } else {
        this._head = null;
        this._tail = null;
      }
      head.owner = null;
    }

    return head;
  }

  pushBack(value: T): Node<T> {
    const node = {
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

  pushFront(value: T): Node<T> {
    const node = {
      value,
      prev: null,
      next: this._head,
      owner: this,
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

  remove(node: MutableNode<T>): boolean {
    const { prev, next, owner } = node;
    if (owner !== this) {
      return false;
    }
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
    node.prev = null;
    node.next = null;
    node.owner = null;
    return true;
  }
}
