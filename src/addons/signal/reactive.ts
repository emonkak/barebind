import { isObject, isPrimitive } from '../../compare.js';
import {
  Atom,
  Computed,
  Signal,
  type Subscriber,
  type Unsubscribe,
} from './signal.js';

const NO_FLAGS = 0;
const FLAG_NEEDS_COMMIT = 0b01;
const FLAG_PENDING_VALUE = 0b10;
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

type Get<T, K extends keyof T> =
  K extends ExplicitKeys<T> ? T[K] : T[K] | undefined;

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

interface ReactiveNode<T> {
  readonly signal: Signal<T>;
  children: Map<PropertyKey, ReactiveNode<unknown>> | null;
  flags: number;
}

type ReactiveKeys<T> = Exclude<AllKeys<T>, FunctionKeys<T>>;

type ReactiveProperty<T, K extends keyof T> = T extends object
  ? IsWritable<T, K> extends true
    ? Reactive<Get<T, K>>
    : Readonly<Reactive<Get<T, K>>>
  : undefined;

type ReactiveValue<T, K extends keyof T> = T extends object
  ? IsWritable<T, K> extends true
    ? Get<T, K>
    : never
  : never;

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
    return commitValue(this._node);
  }

  set value(newValue: T) {
    setValue(this._node, newValue);
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
  ): T extends object ? Reactive<unknown> : undefined;
  get(key: PropertyKey, options?: ReactiveOptions): Reactive<any> | undefined {
    if (isPrimitive(this._node.signal.value)) {
      return undefined;
    }
    const child = getChild(this._node, key);
    return new Reactive(child, options);
  }

  set<K extends ReactiveKeys<T>>(key: K, newValue: ReactiveValue<T, K>): void;
  set(key: PropertyKey, newValue: never): void;
  set(key: PropertyKey, newValue: unknown): void {
    if (isPrimitive(this._node.signal.value)) {
      throw new TypeError('Cannot set property on a primitive value.');
    }
    const child = getChild(this._node, key);
    setValue(child, newValue);
  }

  scope<TResult>(callback: (value: T) => TResult): TResult {
    const value = this._node.signal.value;
    return isObject(value) ? usingProxy(this._node, callback) : callback(value);
  }

  subscribe(subscriber: Subscriber): Unsubscribe {
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

function commitValue<T>(node: ReactiveNode<T>): T {
  const { children, flags, signal } = node;
  let value = signal.value;

  if (flags & FLAG_NEEDS_COMMIT) {
    if (isObject(value)) {
      value = shallowClone(value);
      for (const [key, child] of children!.entries()) {
        if (child.flags & FLAG_PENDING_VALUE) {
          (value as any)[key] = commitValue(child);
          child.flags &= ~FLAG_PENDING_VALUE;
        }
      }
      // Update the value without invalidation.
      (signal as Atom<T>).write(value);
    }
    node.flags &= ~FLAG_NEEDS_COMMIT;
  }

  return value;
}

function createNode<T>(signal: Signal<T>): ReactiveNode<T> {
  return {
    signal,
    children: null,
    flags: NO_FLAGS,
  };
}

function getChild<T>(
  parent: ReactiveNode<T>,
  key: PropertyKey,
): ReactiveNode<unknown> {
  let child = parent.children?.get(key);
  if (child !== undefined) {
    return child;
  }

  child = resolveChild(parent, key);
  if (child.signal instanceof Atom) {
    child.signal.subscribe((event) => {
      parent.flags |= FLAG_DIRTY;
      (parent.signal as Atom<T>).invalidate({
        ...event,
        path: [key, ...event.path],
      });
    });
  }

  parent.children ??= new Map();
  parent.children.set(key, child);

  return child;
}

function resolveChild<T>(
  parent: ReactiveNode<T>,
  key: PropertyKey,
): ReactiveNode<unknown> {
  const { signal } = parent;
  let prototype = signal.value;

  do {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, key);

    if (descriptor !== undefined) {
      const { get, set, value } = descriptor;

      if (get !== undefined) {
        const getter = (proxy: unknown) => get.call(proxy);
        if (set !== undefined) {
          return createNode(new Atom(usingProxy(parent, getter)));
        } else {
          const dependencies: Signal<unknown>[] = [];
          const initialResult = usingProxy(parent, getter, (node) => {
            dependencies.push(node.signal as Signal<unknown>);
            return commitValue(node);
          });
          const initialVersion = dependencies.reduce(
            (version, dependency) => version + dependency.version,
            0,
          );
          return createNode(
            new Computed<unknown>(
              () => usingProxy(parent, getter),
              dependencies,
              initialResult,
              initialVersion,
            ),
          );
        }
      } else {
        return createNode(new Atom(value, signal.version));
      }
    }

    prototype = Object.getPrototypeOf(prototype);
  } while (prototype !== null);

  return createNode(new Atom<unknown>(undefined, signal.version));
}

function setValue<T>(node: ReactiveNode<T>, newValue: T): void {
  node.children = null;
  node.flags |= FLAG_PENDING_VALUE;
  node.flags &= ~FLAG_NEEDS_COMMIT;
  (node.signal as Atom<T>).value = newValue;
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

function usingProxy<TProxy, TResult>(
  parent: ReactiveNode<TProxy>,
  callback: (proxy: TProxy) => TResult,
  getValue: <T>(node: ReactiveNode<T>) => T = commitValue,
): TResult {
  const { proxy, revoke } = Proxy.revocable(
    parent.signal.value as TProxy & object,
    {
      get(_target, key, _receiver) {
        const child = getChild(parent, key);
        return getValue(child);
      },
      set(target, key, value, receiver) {
        const child = getChild(parent, key);
        if (child.signal instanceof Atom) {
          setValue(child, value);
          return true;
        } else {
          return Reflect.set(target, key, value, receiver);
        }
      },
    },
  );
  try {
    return callback(proxy);
  } finally {
    revoke();
  }
}
