export interface Node<T> {
  prev: Node<T> | null;
  next: Node<T> | null;
  value: T;
}

export type NodeRef<T> = { [key: symbol]: Node<T> | undefined };

export interface ReadonlyNode<T> {
  readonly prev: ReadonlyNode<T> | null;
  readonly next: ReadonlyNode<T> | null;
  readonly value: T;
}

export class LinkedList<T> implements Iterable<T> {
  private _head: Node<T> | null = null;

  private _tail: Node<T> | null = null;

  #key: symbol = Symbol();

  *[Symbol.iterator](): Iterator<T> {
    for (let node = this._head; node !== null; node = node.next) {
      yield node.value;
    }
  }

  back(): ReadonlyNode<T> | null {
    return this._tail;
  }

  front(): ReadonlyNode<T> | null {
    return this._head;
  }

  isEmpty(): boolean {
    return this._head === null;
  }

  popBack(): Node<T> | null {
    const tail = this._tail;

    if (tail !== null && tail.prev !== null) {
      this._tail = tail.prev;
      this._tail.next = null;
      tail.prev = null;
    } else {
      this._head = null;
      this._tail = null;
    }

    return tail;
  }

  popFront(): Node<T> | null {
    const head = this._head;

    if (head !== null && head.next !== null) {
      this._head = head.next;
      this._head.prev = null;
      head.next = null;
    } else {
      this._head = null;
      this._tail = null;
    }

    return head;
  }

  pushBack(value: T): NodeRef<T> {
    const node = { prev: this._tail, next: null, value };

    if (this._tail !== null) {
      this._tail.next = node;
      this._tail = node;
    } else {
      this._head = node;
      this._tail = node;
    }

    return { [this.#key]: node };
  }

  pushFront(value: T): NodeRef<T> {
    const node = { prev: null, next: this._head, value };

    if (this._head !== null) {
      this._head.prev = node;
      this._head = node;
    } else {
      this._head = node;
      this._tail = node;
    }

    return { [this.#key]: node };
  }

  remove(nodeRef: NodeRef<T>): Node<T> | null {
    const node = nodeRef[this.#key];
    if (node === undefined) {
      return null;
    }
    if (node.prev !== null) {
      node.prev.next = node.next;
    } else {
      this._head = node.next;
    }
    if (node.next !== null) {
      node.next.prev = node.prev;
    } else {
      this._tail = node.prev;
    }
    node.prev = null;
    node.next = null;
    nodeRef[this.#key] = undefined;
    return node;
  }
}
