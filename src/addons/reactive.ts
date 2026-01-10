import {
  Atom,
  Computed,
  Signal,
  type Subscriber,
  type Subscription,
} from './signal.js';

const NO_FLAGS = 0;
const FLAG_NEEDS_SNAPSHOT = 0b1;
const FLAG_NEEDS_COLLECTION = 0b10;
const FLAG_PENGING_VALUE = 0b100;
const FLAG_PENDING_DIFFERENCE = 0b1000;
const FLAG_DIRTY = 0b0111;

export interface Difference {
  path: PropertyKey[];
  value: unknown;
}

export interface ReactiveOptions {
  shallow?: boolean;
}

type AllKeys<T> = T extends any ? keyof T : never;

type ExplicitKeys<T> = {
  [K in AllKeys<T>]: IsPropertyKey<K> extends true ? never : K;
}[AllKeys<T>];

type FunctionKeys<T> = {
  [K in AllKeys<T>]: T[K] extends Function ? K : never;
}[AllKeys<T>];

type Get<T, K extends keyof T> = K extends ExplicitKeys<T>
  ? T[K]
  : T[K] | undefined;

type IsArray<T> = T extends readonly any[] ? true : false;

type IsPropertyKey<K> = string extends K
  ? true
  : number extends K
    ? true
    : symbol extends K
      ? true
      : false;

type IsWritable<T, K extends keyof T> = StrictEqual<
  { -readonly [P in K]-?: T[P] },
  Pick<T, K>
>;

type Or<TLhs extends boolean, TRhs extends boolean> = TLhs extends true
  ? true
  : TRhs extends true
    ? true
    : false;

interface ReactiveContainer<T> {
  readonly signal: Signal<T>;
  children: Map<PropertyKey, ReactiveContainer<unknown>> | null;
  flags: number;
}

type ReactiveKeys<T> = Exclude<AllKeys<T>, FunctionKeys<T>>;

type ReactiveProperty<T, K extends keyof T> = T extends object
  ? Or<IsWritable<T, K>, IsArray<T>> extends true
    ? Reactive<Get<T, K>>
    : Readonly<Reactive<Get<T, K>>>
  : null;

type StrictEqual<TLhs, TRhs> =
  (<T>() => T extends TLhs ? 1 : 2) extends <T>() => T extends TRhs ? 1 : 2
    ? true
    : false;

export class Reactive<T> extends Signal<T> {
  private readonly _container: ReactiveContainer<T>;

  private readonly _shallow: boolean;

  static from<T>(value: T, options?: ReactiveOptions): Reactive<T> {
    return new Reactive(createContainer(new Atom(value)), options);
  }

  private constructor(
    container: ReactiveContainer<T>,
    options: ReactiveOptions = {},
  ) {
    super();
    this._container = container;
    this._shallow = options.shallow ?? false;
  }

  get value(): T {
    return takeSnapshot(this._container);
  }

  set value(value: T) {
    if (!(this._container.signal instanceof Atom)) {
      throw new TypeError('Cannot set value on a read-only value.');
    }

    // To ensure shallow subscription work properly, flags must be changed
    // before setting a new value.
    this._container.children = null;
    this._container.flags |= FLAG_PENGING_VALUE | FLAG_PENDING_DIFFERENCE;
    this._container.flags &= ~(FLAG_NEEDS_SNAPSHOT | FLAG_NEEDS_COLLECTION);
    this._container.signal.value = value;
  }

  get version(): number {
    return this._container.signal.version;
  }

  applyDifference(difference: Difference): void {
    const { path, value } = difference;
    let reactive: Reactive<unknown> | null = this;
    for (let i = 0, l = path.length; i < l; i++) {
      reactive = reactive.get(path[i]!);
      if (reactive === null) {
        return;
      }
    }
    reactive.value = value;
  }

  collectDifferences(): Difference[] {
    const differences: Difference[] = [];
    collectDefferences(this._container, differences);
    for (let i = 0, l = differences.length; i < l; i++) {
      // The path is constructed in reverse order from child to parent.
      differences[i]!.path.reverse();
    }
    return differences;
  }

  get<K extends ReactiveKeys<T>>(
    key: K,
    options?: ReactiveOptions,
  ): ReactiveProperty<T, K>;
  get(
    key: PropertyKey,
    options?: ReactiveOptions,
  ): T extends object ? Reactive<unknown> : null;
  get(key: PropertyKey, options?: ReactiveOptions): Reactive<unknown> | null {
    if (!isObjectContainer(this._container)) {
      return null;
    }

    const child = getChild(this._container, key);

    return new Reactive(child, options);
  }

  mutate<TResult>(callback: (value: T) => TResult): TResult {
    if (!(this._container.signal instanceof Atom)) {
      throw new TypeError('Cannot mutate value with a readonly value.');
    }

    if (!isObjectContainer(this._container)) {
      throw new TypeError('Cannot mutate value with a non-object value.');
    }

    const proxy = proxyObject(this._container);

    return callback(proxy);
  }

  subscribe(subscriber: Subscriber): Subscription {
    const container = this._container;

    if (this._shallow) {
      return container.signal.subscribe(() => {
        if (!(container.flags & FLAG_NEEDS_SNAPSHOT)) {
          subscriber();
        }
      });
    } else {
      return container.signal.subscribe(subscriber);
    }
  }
}

function collectDefferences<T>(
  container: ReactiveContainer<T>,
  differences: Difference[],
): void {
  const { signal, children, flags } = container;

  if (flags & FLAG_NEEDS_COLLECTION) {
    for (const [key, child] of children!.entries()) {
      if (child !== null) {
        const startIndex = differences.length;
        collectDefferences(child, differences);
        for (let i = startIndex, l = differences.length; i < l; i++) {
          differences[i]!.path.push(key);
        }
      }
    }

    container.flags &= ~FLAG_NEEDS_COLLECTION;
  }

  if (flags & FLAG_PENDING_DIFFERENCE) {
    differences.push({ path: [], value: signal.value });
    container.flags &= ~FLAG_PENDING_DIFFERENCE;
  }
}

function createContainer<T>(signal: Signal<T>): ReactiveContainer<T> {
  return {
    signal,
    children: null,
    flags: NO_FLAGS,
  };
}

function getChild<T extends object>(
  parent: ReactiveContainer<T>,
  key: PropertyKey,
): ReactiveContainer<unknown> {
  let child = parent.children?.get(key);
  if (child !== undefined) {
    return child;
  }

  child = resolveChild(parent, key);

  if (parent.signal instanceof Atom && child.signal instanceof Atom) {
    child.signal.subscribe(() => {
      parent.flags |= FLAG_DIRTY;
      (parent.signal as Atom<T>).touch();
    });
  }

  parent.children ??= new Map();
  parent.children.set(key, child);

  return child;
}

function isObject<T>(value: T): value is T & object {
  return typeof value === 'object' && value !== null;
}

function isObjectContainer<T>(
  container: ReactiveContainer<T>,
): container is ReactiveContainer<T & object> {
  return isObject(container.signal.value);
}

function proxyObject<T extends object>(
  parent: ReactiveContainer<T>,
  getValue: <T>(container: ReactiveContainer<T>) => T = takeSnapshot,
): T {
  return new Proxy(parent.signal.value, {
    get(_target, key, _receiver) {
      const child = getChild(parent, key);
      return getValue(child);
    },
    set(target, key, value, receiver) {
      const child = getChild(parent, key);
      if (child.signal instanceof Atom) {
        child.children = null;
        child.flags |= FLAG_PENGING_VALUE | FLAG_PENDING_DIFFERENCE;
        child.flags &= ~(FLAG_NEEDS_SNAPSHOT | FLAG_NEEDS_COLLECTION);
        child.signal.value = value;
        return true;
      } else {
        return Reflect.set(target, key, value, receiver);
      }
    },
  });
}

function resolveChild<T extends object>(
  parent: ReactiveContainer<T>,
  key: PropertyKey,
): ReactiveContainer<unknown> {
  const root = parent.signal.value;
  let prototype = root;

  do {
    const propertyDescriptor = Object.getOwnPropertyDescriptor(prototype, key);

    if (propertyDescriptor !== undefined) {
      const { get, set, value } = propertyDescriptor;

      if (get !== undefined && set !== undefined) {
        return createContainer(new Atom(get.call(proxyObject(parent))));
      } else if (get !== undefined) {
        const dependencies: Signal<unknown>[] = [];
        const proxy = proxyObject(parent, (container) => {
          dependencies.push(container.signal);
          return takeSnapshot(container);
        });
        const initialResult = get.call(proxy);
        const initialVersion = dependencies.reduce(
          (version, dependency) => version + dependency.version,
          0,
        );
        const signal = new Computed<unknown>(
          () => get.call(proxyObject(parent)),
          dependencies,
          initialResult,
          initialVersion,
        );
        return createContainer(signal);
      } else {
        return createContainer(new Atom(value, parent.signal.version));
      }
    }

    prototype = Object.getPrototypeOf(prototype);
  } while (prototype !== null && prototype !== Object.prototype);

  return createContainer(new Atom(undefined, parent.signal.version));
}

function shallowClone<T extends object>(object: T): T {
  if (Array.isArray(object)) {
    return object.slice() as T;
  } else {
    return Object.create(
      Object.getPrototypeOf(object),
      Object.getOwnPropertyDescriptors(object),
    );
  }
}

function takeSnapshot<T>(container: ReactiveContainer<T>): T {
  const { children, flags, signal } = container;

  if (flags & FLAG_NEEDS_SNAPSHOT) {
    const oldValue = signal.value;

    if (isObject(oldValue)) {
      const newValue = shallowClone(oldValue);

      for (const [key, child] of children!.entries()) {
        if (child !== null && child.flags & FLAG_PENGING_VALUE) {
          (newValue as any)[key] = takeSnapshot(child);
          child.flags &= ~FLAG_PENGING_VALUE;
        }
      }

      // Update the source without notification (a container with dirty flags
      // is always Atom).
      (signal as Atom<T>).poke(newValue);
    }

    container.flags &= ~FLAG_NEEDS_SNAPSHOT;
  }

  return signal.value;
}
