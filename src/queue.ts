export class PriorityQueue<T> {
  /** @internal */
  readonly _heap: T[] = [];
  /** @internal */
  readonly _compare: (x: T, y: T) => number;

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
      shiftDown(this, 0);
    }

    return first;
  }

  enqueue(value: T): void {
    this._heap.push(value);
    shiftUp(this, this._heap.length - 1);
  }

  peek(): T | undefined {
    return this._heap[0];
  }
}

function shiftDown<T>(queue: PriorityQueue<T>, index: number): void {
  const length = queue._heap.length;
  const compare = queue._compare;

  while (true) {
    const left = (index << 1) + 1;
    const right = left + 1;
    let smallest = index;

    if (
      left < length &&
      compare(queue._heap[left]!, queue._heap[smallest]!) < 0
    ) {
      smallest = left;
    }
    if (
      right < length &&
      compare(queue._heap[right]!, queue._heap[smallest]!) < 0
    ) {
      smallest = right;
    }

    if (smallest === index) {
      break;
    }

    swap(queue._heap, index, smallest);
    index = smallest;
  }
}

function shiftUp<T>(queue: PriorityQueue<T>, index: number): void {
  const compare = queue._compare;
  while (index > 0) {
    const parent = (index - 1) >> 1;
    if (compare(queue._heap[index]!, queue._heap[parent]!) >= 0) {
      break;
    }
    swap(queue._heap, index, parent);
    index = parent;
  }
}

function swap<T>(heap: T[], i: number, j: number): void {
  const tmp = heap[i]!;
  heap[i] = heap[j]!;
  heap[j] = tmp;
}
