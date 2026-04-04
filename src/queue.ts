export class Queue<T> {
  private readonly _items: (T | undefined)[] = [];
  private _head: number = 0;

  *[Symbol.iterator](): Generator<T> {
    for (let i = this._head, l = this._items.length; i < l; i++) {
      yield this._items[i]!;
    }
  }

  dequeue(): T | undefined {
    if (this._items.length === 0) {
      return undefined;
    }

    const item = this._items[this._head];
    this._items[this._head] = undefined;
    this._head++;

    if (this._head === this._items.length) {
      this._items.length = 0;
      this._head = 0;
    }

    return item;
  }

  enqueue(item: T): void {
    this._items.push(item);
  }

  peek(): T | undefined {
    return this._items[this._head];
  }
}
