export class PriorityQueue<T> {
  private readonly _heap: T[] = [];

  private readonly _compare: (x: T, y: T) => number;

  constructor(compare: (x: T, y: T) => number) {
    this._compare = compare;
  }

  dequeue(): T | undefined {
    if (this._heap.length === 0) {
      return undefined;
    }

    const first = this._heap[0];
    const last = this._heap.pop()!;

    if (this._heap.length > 0) {
      this._heap[0] = last;
      this._shiftDown(0);
    }

    return first;
  }

  enqueue(value: T): void {
    this._heap.push(value);
    this._shiftUp(this._heap.length - 1);
  }

  peek(): T | undefined {
    return this._heap[0];
  }

  private _shiftDown(index: number): void {
    const length = this._heap.length;
    const compare = this._compare;

    while (true) {
      const left = (index << 1) + 1;
      const right = left + 1;
      let smallest = index;

      if (
        left < length &&
        compare(this._heap[left]!, this._heap[smallest]!) < 0
      ) {
        smallest = left;
      }
      if (
        right < length &&
        compare(this._heap[right]!, this._heap[smallest]!) < 0
      ) {
        smallest = right;
      }

      if (smallest === index) {
        break;
      }

      swap(this._heap, index, smallest);
      index = smallest;
    }
  }

  private _shiftUp(index: number): void {
    const compare = this._compare;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (compare(this._heap[index]!, this._heap[parent]!) >= 0) {
        break;
      }
      swap(this._heap, index, parent);
      index = parent;
    }
  }
}

function swap<T>(heap: T[], i: number, j: number): void {
  const tmp = heap[i]!;
  heap[i] = heap[j]!;
  heap[j] = tmp;
}
