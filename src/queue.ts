interface Node<T> {
  value: T;
  next: Node<T> | null;
}

export class Queue<T> {
  private _head: Node<T> | null = null;
  private _tail: Node<T> | null = null;

  *[Symbol.iterator](): Generator<T> {
    for (let node = this._head; node !== null; node = node.next) {
      yield node.value;
      if (node === this._tail) {
        break;
      }
    }
  }

  enqueue(value: T): void {
    const node: Node<T> = {
      value: value,
      next: null,
    };
    if (this._tail !== null) {
      this._tail.next = node;
    } else {
      this._head = node;
    }
    this._tail = node;
  }

  dequeue(): T | undefined {
    if (this._head === null) {
      return undefined;
    }
    const { value, next } = this._head;
    this._head = next;
    if (next === null) {
      this._tail = null;
    }
    return value;
  }

  peek(): T | undefined {
    return this._head?.value;
  }
}
