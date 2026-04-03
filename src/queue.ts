interface Item<T> {
  value: T;
  next: Item<T> | null;
}

export class Queue<T> {
  private _head: Item<T> | null = null;
  private _tail: Item<T> | null = null;

  *[Symbol.iterator](): Generator<T> {
    for (let item = this._head; item !== null; item = item.next) {
      yield item.value;
      if (item === this._tail) {
        break;
      }
    }
  }

  enqueue(value: T): void {
    const item: Item<T> = {
      value: value,
      next: null,
    };
    if (this._tail !== null) {
      this._tail.next = item;
    } else {
      this._head = item;
    }
    this._tail = item;
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
