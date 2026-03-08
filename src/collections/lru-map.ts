import { LinkedList } from './linked-list.js';

interface Entry<K, V> {
  key: LinkedList.Node<K>;
  value: V;
}

export type EvictCallback<K, V> = (entry: EvictEntry<K, V>) => void;

export type EvictEntry<K, V> = { key: K; value: V };

export class LRUMap<K, V> implements Iterable<[K, V]> {
  private readonly _entries: Map<K, Entry<K, V>> = new Map();

  private readonly _recentKeys: LinkedList<K> = new LinkedList();

  private _capacity: number;

  private _callback: EvictCallback<K, V> | null;

  constructor(capacity: number, callback: EvictCallback<K, V> | null = null) {
    this._capacity = capacity;
    this._callback = callback;
  }

  get capacity(): number {
    return this._capacity;
  }

  get size(): number {
    return this._entries.size;
  }

  [Symbol.iterator](): Generator<[K, V]> {
    return this.entries();
  }

  clear(): void {
    this._entries.clear();
    this._recentKeys.clear();
  }

  delete(key: K): V | undefined {
    const entry = this._entries.get(key);

    if (entry !== undefined) {
      this._entries.delete(key);
      this._recentKeys.remove(entry.key);
      return entry.value;
    }

    return undefined;
  }

  *entries(): Generator<[K, V]> {
    for (const key of this._recentKeys) {
      yield [key, this._entries.get(key)?.value!];
    }
  }

  get(key: K): V | undefined {
    const entry = this._entries.get(key);

    if (entry !== undefined) {
      this._recentKeys.remove(entry.key);
      entry.key = this._recentKeys.pushFront(entry.key.value);
      return entry.value;
    }

    return undefined;
  }

  getOrInsert(key: K, defaultValue: V): V {
    return this.getOrInsertComputed(key, () => defaultValue);
  }

  getOrInsertComputed(key: K, callback: (key: K) => V): V {
    const value = this.get(key);
    if (value !== undefined) {
      return value;
    }
    const defaultValue = callback(key);
    this._insertEntry(key, defaultValue);
    this._evictToCapacity();
    return defaultValue;
  }

  has(key: K): boolean {
    return this._entries.has(key);
  }

  *keys(): Generator<K> {
    for (const key of this._recentKeys) {
      yield key;
    }
  }

  resize(capacity: number): void {
    this._capacity = capacity;
    this._evictToCapacity();
  }

  set(key: K, value: V): V | undefined {
    const entry = this._entries.get(key);

    if (entry !== undefined) {
      const oldValue = entry.value;
      this._recentKeys.remove(entry.key);
      entry.key = this._recentKeys.pushFront(key);
      entry.value = value;
      return oldValue;
    }

    this._insertEntry(key, value);
    this._evictToCapacity();

    return undefined;
  }

  *values(): Generator<V> {
    for (const key of this._recentKeys) {
      yield this._entries.get(key)?.value!;
    }
  }

  private _evictToCapacity(): void {
    while (this._entries.size > this._capacity) {
      const lruKey = this._recentKeys.popBack();
      if (lruKey !== null) {
        const key = lruKey.value;
        const { value } = this._entries.get(key)!;
        this._entries.delete(key);
        this._callback?.({ key, value });
      }
    }
  }

  private _insertEntry(key: K, value: V): void {
    const newEntry = { key: this._recentKeys.pushFront(key), value };
    this._entries.set(key, newEntry);
  }
}
