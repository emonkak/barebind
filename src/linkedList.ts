export interface LinkedListNode<T> {
  value: T;
  prev: LinkedListNode<T> | null;
  next: LinkedListNode<T> | null;
  owner: LinkedList<T> | null;
}

export class LinkedList<T> implements Iterable<T> {
  private _head: LinkedListNode<T> | null = null;

  private _tail: LinkedListNode<T> | null = null;

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

  popFront(): LinkedListNode<T> | null {
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

  pushBack(value: T): LinkedListNode<T> {
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

  pushFront(value: T): LinkedListNode<T> {
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

  remove(node: LinkedListNode<T>): boolean {
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
