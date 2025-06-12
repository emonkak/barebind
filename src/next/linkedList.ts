export interface LinkedListNode<T> {
  readonly value: T;
  readonly prev: LinkedListNode<T> | null;
  readonly next: LinkedListNode<T> | null;
  readonly root: LinkedList<T> | null;
}

interface Node<T> {
  value: T;
  prev: Node<T> | null;
  next: Node<T> | null;
  root: LinkedList<T> | null;
}

export class LinkedList<T> implements Iterable<T> {
  private _head: Node<T> | null = null;

  private _tail: Node<T> | null = null;

  *[Symbol.iterator](): Iterator<T> {
    for (let node = this._head; node !== null; node = node.next) {
      yield node.value;
    }
  }

  back(): LinkedListNode<T> | null {
    return this._tail;
  }

  front(): LinkedListNode<T> | null {
    return this._head;
  }

  isEmpty(): boolean {
    return this._head === null;
  }

  popBack(): LinkedListNode<T> | null {
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
    tail.root = null;
    return tail;
  }

  popFront(): LinkedListNode<T> | null {
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
    head.root = null;
    return head;
  }

  pushBack(value: T): LinkedListNode<T> {
    const node = {
      value,
      prev: this._tail,
      next: null,
      root: this,
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

  pushFront(value: T): LinkedListNode<T> {
    const node = {
      value,
      prev: null,
      next: this._head,
      root: this,
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

  remove(node: LinkedListNode<T>): boolean {
    const { prev, next, root } = node as Node<T>;
    if (root !== this) {
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
    (node as Node<T>).prev = null;
    (node as Node<T>).next = null;
    (node as Node<T>).root = null;
    return true;
  }
}
