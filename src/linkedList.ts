export interface LinkedListNode<T> {
  value: T;
  prev: LinkedListNode<T> | null;
  next: LinkedListNode<T> | null;
  ownership: symbol | null;
}

export class LinkedList<T> implements Iterable<T> {
  #head: LinkedListNode<T> | null = null;

  #tail: LinkedListNode<T> | null = null;

  #ownership: symbol = Symbol();

  *[Symbol.iterator](): Iterator<T> {
    for (let node = this.#head; node !== null; node = node.next) {
      yield node.value;
    }
  }

  back(): LinkedListNode<T> | null {
    return this.#tail;
  }

  front(): LinkedListNode<T> | null {
    return this.#head;
  }

  isEmpty(): boolean {
    return this.#head === null;
  }

  popBack(): LinkedListNode<T> | null {
    const tail = this.#tail;

    if (tail !== null) {
      if (tail.prev !== null) {
        this.#tail = tail.prev;
        this.#tail.next = null;
        tail.prev = null;
      } else {
        this.#head = null;
        this.#tail = null;
      }
      tail.ownership = null;
    }

    return tail;
  }

  popFront(): LinkedListNode<T> | null {
    const head = this.#head;

    if (head !== null) {
      if (head.next !== null) {
        this.#head = head.next;
        this.#head.prev = null;
        head.next = null;
      } else {
        this.#head = null;
        this.#tail = null;
      }
      head.ownership = null;
    }

    return head;
  }

  pushBack(value: T): LinkedListNode<T> {
    const node = {
      value,
      prev: this.#tail,
      next: null,
      ownership: this.#ownership,
    };

    if (this.#tail !== null) {
      this.#tail.next = node;
      this.#tail = node;
    } else {
      this.#head = node;
      this.#tail = node;
    }

    return node;
  }

  pushFront(value: T): LinkedListNode<T> {
    const node = {
      value,
      prev: null,
      next: this.#head,
      ownership: this.#ownership,
    };

    if (this.#head !== null) {
      this.#head.prev = node;
      this.#head = node;
    } else {
      this.#head = node;
      this.#tail = node;
    }

    return node;
  }

  remove(node: LinkedListNode<T>): boolean {
    const { ownership, prev, next } = node;
    if (ownership !== this.#ownership) {
      return false;
    }
    if (prev !== null) {
      prev.next = next;
    } else {
      this.#head = next;
    }
    if (next !== null) {
      next.prev = prev;
    } else {
      this.#tail = prev;
    }
    node.prev = null;
    node.next = null;
    node.ownership = null;
    return true;
  }
}
