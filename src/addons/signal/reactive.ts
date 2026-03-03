import {
  Atom,
  Computed,
  Signal,
  type Subscriber,
  type Subscription,
} from './signal.js';

const NO_FLAGS = 0;
const FLAG_NEEDS_SNAPSHOT = 0b01;
const FLAG_PENGING_VALUE = 0b10;
const FLAG_DIRTY = 0b11;

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

interface ReactiveNode<T> {
  readonly signal: Signal<T>;
  children: Map<PropertyKey, ReactiveNode<unknown>> | null;
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
  private readonly _node: ReactiveNode<T>;

  private readonly _shallow: boolean;

  static from<T>(value: T, options?: ReactiveOptions): Reactive<T> {
    return new Reactive(createNode(new Atom(value)), options);
  }

  private constructor(node: ReactiveNode<T>, options: ReactiveOptions = {}) {
    super();
    this._node = node;
    this._shallow = options.shallow ?? false;
  }

  get value(): T {
    return takeSnapshot(this._node);
  }

  set value(value: T) {
    if (!(this._node.signal instanceof Atom)) {
      throw new TypeError('Cannot set value on a read-only signal.');
    }

    this._node.children = null;
    this._node.flags |= FLAG_PENGING_VALUE;
    this._node.flags &= ~FLAG_NEEDS_SNAPSHOT;
    this._node.signal.value = value;
  }

  get version(): number {
    return this._node.signal.version;
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
    if (!isObject(this._node.signal.value)) {
      return null;
    }

    const child = getChild(this._node, key);
    return new Reactive(child, options);
  }

  mutate<TResult>(callback: (value: T) => TResult): TResult {
    if (!(this._node.signal instanceof Atom)) {
      throw new TypeError('Cannot mutate value with a readonly signal.');
    }

    if (!isObject(this._node.signal.value)) {
      throw new TypeError('Cannot mutate value with a non-object signal.');
    }

    const proxy = proxyObject(this._node);
    return callback(proxy);
  }

  subscribe(subscriber: Subscriber): Subscription {
    const { signal } = this._node;

    if (this._shallow) {
      return signal.subscribe((event) => {
        if (event.source === signal) {
          subscriber(event);
        }
      });
    } else {
      return signal.subscribe(subscriber);
    }
  }
}

function createNode<T>(signal: Signal<T>): ReactiveNode<T> {
  return {
    signal,
    children: null,
    flags: NO_FLAGS,
  };
}

function getChild<T>(
  node: ReactiveNode<T>,
  key: PropertyKey,
): ReactiveNode<unknown> {
  let child = node.children?.get(key);
  if (child !== undefined) {
    return child;
  }

  child = resolveChild(node, key);

  if (node.signal instanceof Atom && child.signal instanceof Atom) {
    child.signal.subscribe((event) => {
      node.flags |= FLAG_DIRTY;
      (node.signal as Atom<T>).invalidate({
        ...event,
        path: [key, ...event.path],
      });
    });
  }

  node.children ??= new Map();
  node.children.set(key, child);

  return child;
}

function isObject<T>(value: T): value is T & object {
  return typeof value === 'object' && value !== null;
}

function proxyObject<T>(
  node: ReactiveNode<T>,
  getValue: <T>(node: ReactiveNode<T>) => T = takeSnapshot,
): T {
  return new Proxy(node.signal.value as T & object, {
    get(_target, key, _receiver) {
      const child = getChild(node, key);
      return getValue(child);
    },
    set(target, key, value, receiver) {
      const child = getChild(node, key);
      if (child.signal instanceof Atom) {
        child.children = null;
        child.flags |= FLAG_PENGING_VALUE;
        child.flags &= ~FLAG_NEEDS_SNAPSHOT;
        child.signal.value = value;
        return true;
      } else {
        return Reflect.set(target, key, value, receiver);
      }
    },
  });
}

function resolveChild<T>(
  node: ReactiveNode<T>,
  key: PropertyKey,
): ReactiveNode<unknown> {
  const { signal } = node;
  let prototype = signal.value;

  do {
    const propertyDescriptor = Object.getOwnPropertyDescriptor(prototype, key);

    if (propertyDescriptor !== undefined) {
      const { get, set, value } = propertyDescriptor;

      if (get !== undefined && set !== undefined) {
        return createNode(new Atom(get.call(proxyObject(node))));
      } else if (get !== undefined) {
        const dependencies: Signal<unknown>[] = [];
        const proxy = proxyObject(node, (node) => {
          dependencies.push(node.signal);
          return takeSnapshot(node);
        });
        const initialResult = get.call(proxy);
        const initialVersion = dependencies.reduce(
          (version, dependency) => version + dependency.version,
          0,
        );
        const signal = new Computed<unknown>(
          () => get.call(proxyObject(node)),
          dependencies,
          initialResult,
          initialVersion,
        );
        return createNode(signal);
      } else {
        return createNode(new Atom(value, signal.version));
      }
    }

    prototype = Object.getPrototypeOf(prototype);
  } while (prototype !== null && prototype !== Object.prototype);

  return createNode(new Atom(undefined, signal.version));
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

function takeSnapshot<T>(node: ReactiveNode<T>): T {
  const { children, flags, signal } = node;

  if (flags & FLAG_NEEDS_SNAPSHOT) {
    const oldValue = signal.value;

    if (isObject(oldValue)) {
      const newValue = shallowClone(oldValue);

      for (const [key, child] of children!.entries()) {
        if (child.flags & FLAG_PENGING_VALUE) {
          (newValue as any)[key] = takeSnapshot(child);
          child.flags &= ~FLAG_PENGING_VALUE;
        }
      }

      // Update the value without invalidation.
      (signal as Atom<T>).poke(newValue);
    }

    node.flags &= ~FLAG_NEEDS_SNAPSHOT;
  }

  return signal.value;
}
