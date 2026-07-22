import { isObject, isPrimitive } from '../../compare.js';
import {
  Atom,
  Computed,
  Signal,
  type Subscriber,
  type Unsubscribe,
} from './signal.js';

const NO_FLAGS /*                 */ = 0;
const FLAG_NEEDS_COMMIT /*        */ = 0b00001;
const FLAG_PENDING_VALUE /*       */ = 0b00010;
const FLAG_DIRTY_VALUE /*         */ = 0b00011;
const FLAG_ENUMERABLE_PROPERTY /* */ = 0b00100;
const FLAG_DYNAMIC_PROPERTY /*    */ = 0b01000;
const FLAG_DELETED_PROPERTY /*    */ = 0b10000;

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

type NormalizedKey = string | symbol;

interface ReactiveNode<T> {
  signal: Signal<T>;
  children: Map<NormalizedKey, ReactiveNode<unknown>> | null;
  flags: number;
}

type ReactiveKeys<T> = Exclude<AllKeys<T>, FunctionKeys<T>>;

type ReactiveProperty<T, K extends keyof T> = T extends object
  ? IsWritable<T, K> extends true
    ? Reactive<Get<T, K>>
    : Readonly<Reactive<Get<T, K>>>
  : undefined;

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
    setPendingValue(this._node, newValue);
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
    const child = getChild(this._node, normalizeKey(key));
    return new Reactive(child, options);
  }

  scope<TResult>(
    callback: (draft: T, toSnapshot: <T>(draft: T) => T) => TResult,
  ): TResult {
    const value = this._node.signal.value;
    const snapshotTag = Symbol();
    const toSnapshot = (draft: any) => draft[snapshotTag] ?? draft;
    return callback(
      isObject(value) ? createDraft(this._node, snapshotTag) : value,
      toSnapshot,
    );
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
  let pendingValue = signal.value;

  if (flags & FLAG_NEEDS_COMMIT) {
    if (isObject(pendingValue)) {
      pendingValue = shallowClone(pendingValue);
      for (const [key, child] of children!.entries()) {
        if (child.flags & FLAG_DELETED_PROPERTY) {
          delete (pendingValue as any)[key];
        } else if (child.flags & FLAG_PENDING_VALUE) {
          (pendingValue as any)[key] = commitValue(child);
          child.flags &= ~FLAG_PENDING_VALUE;
        }
      }
      // SAFETY: A signal of the node with dirty flag is always Atom.
      (signal as Atom<T>).write(pendingValue);
    }
    node.flags &= ~FLAG_NEEDS_COMMIT;
  }

  return pendingValue;
}

function createDraft<T>(
  node: ReactiveNode<T>,
  snapshotTag: Symbol = Symbol(),
  finalizeValue: <T>(node: ReactiveNode<T>) => T = commitValue,
): T {
  const { signal } = node;
  if (signal instanceof Atom) {
    return new Proxy(signal.value, {
      deleteProperty(_target, key) {
        const prop = getChild(node, key);
        signal.invalidate({
          source: prop.signal,
          path: [key],
          oldValue: prop.signal.value,
          newValue: undefined,
        });
        node.flags |= FLAG_DIRTY_VALUE;
        prop.flags |= FLAG_DELETED_PROPERTY;
        return true;
      },
      get(target, key, receiver) {
        if (key === snapshotTag) {
          return finalizeValue(node);
        } else {
          const prop = getChild(node, key);
          if (prop.flags & FLAG_DELETED_PROPERTY) {
            return undefined;
          }
          if (!(prop.flags & (FLAG_PENDING_VALUE | FLAG_ENUMERABLE_PROPERTY))) {
            return Reflect.get(target, key, receiver);
          }
          if (isPrimitive(prop.signal.value)) {
            return finalizeValue(prop);
          }
          return createDraft(prop, snapshotTag);
        }
      },
      getOwnPropertyDescriptor(target, key) {
        const prop = getChild(node, key);
        if (prop.flags & FLAG_DELETED_PROPERTY) {
          return undefined;
        }
        if (prop.flags & FLAG_DYNAMIC_PROPERTY) {
          return {
            value: prop.signal.value,
            writable: true,
            enumerable: true,
            configurable: true,
          };
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
      set(_target, key, value, _receiver) {
        const prop = getChild(node, key);
        setPendingValue(prop, value);
        return true;
      },
      has(target, key) {
        const prop = node.children?.get(key);
        return prop !== undefined
          ? !(prop.flags & FLAG_DELETED_PROPERTY)
          : Reflect.has(target, key);
      },
      ownKeys(target) {
        const baseKeys = Reflect.ownKeys(target);
        if (node.children !== null) {
          const dynamicKeys: NormalizedKey[] = [];
          const deletedKeys: NormalizedKey[] = [];
          for (const [key, child] of node.children.entries()) {
            if (child.flags & FLAG_DELETED_PROPERTY) {
              deletedKeys.push(key);
            } else if (child.flags & FLAG_DYNAMIC_PROPERTY) {
              dynamicKeys.push(key);
            }
          }
          if (dynamicKeys.length > 0 || deletedKeys.length > 0) {
            return Array.from(
              new Set(baseKeys)
                .difference(new Set(deletedKeys))
                .union(new Set(dynamicKeys)),
            );
          }
        }
        return baseKeys;
      },
    });
  } else {
    return node.signal.value;
  }
}

function createNode<T>(signal: Signal<T>, flags = NO_FLAGS): ReactiveNode<T> {
  return {
    signal,
    children: null,
    flags,
  };
}

function getChild<T>(
  parent: ReactiveNode<T>,
  key: NormalizedKey,
): ReactiveNode<unknown> {
  let child = parent.children?.get(key);
  if (child !== undefined) {
    return child;
  }

  child = resolveChild(parent, key);

  if (child.signal instanceof Atom) {
    child.signal.subscribe((event) => {
      // SAFETY: When the child is Atom, the parent is also Atom.
      (parent.signal as Atom<T>).invalidate({
        source: event.source,
        path: [key, ...event.path],
        oldValue: event.oldValue,
        newValue: event.newValue,
      });
      parent.flags |= FLAG_DIRTY_VALUE;
    });
  }

  parent.children ??= new Map();
  parent.children.set(key, child);

  return child;
}

function normalizeKey(key: PropertyKey): string | symbol {
  return typeof key === 'number' ? key.toString() : key;
}

function resolveChild<T>(
  parent: ReactiveNode<T>,
  key: PropertyKey,
): ReactiveNode<unknown> {
  const { signal } = parent;

  if (signal instanceof Atom) {
    let proto = signal.value;
    do {
      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (descriptor !== undefined) {
        const { get, set, value, enumerable } = descriptor;
        const flags = enumerable ? FLAG_ENUMERABLE_PROPERTY : NO_FLAGS;
        if (get !== undefined) {
          if (set !== undefined) {
            return createNode(new Atom(get.call(createDraft(parent))), flags);
          } else {
            const dependencies: Signal<unknown>[] = [];
            const initialResult = get.call(
              createDraft(parent, undefined, (node) => {
                dependencies.push(node.signal as Signal<unknown>);
                return commitValue(node);
              }),
            );
            const initialVersion = dependencies.reduce(
              (version, dependency) => version + dependency.version,
              0,
            );
            return createNode(
              new Computed(
                () => get.call(createDraft(parent)),
                dependencies,
                initialResult,
                initialVersion,
              ),
              flags,
            );
          }
        } else {
          return createNode(new Atom(value), flags);
        }
      }
      proto = Object.getPrototypeOf(proto);
    } while (proto !== null);

    return createNode(new Atom<unknown>(undefined), FLAG_DYNAMIC_PROPERTY);
  } else {
    return createNode(
      new Computed<unknown>(() => (signal.value as any)[key], [signal]),
    );
  }
}

function setPendingValue<T>(node: ReactiveNode<T>, newValue: T): void {
  // Intentionally throws a TypeError if signal is a Computed (which has no setter).
  (node.signal as Atom<T>).value = newValue;
  node.children?.clear();
  node.flags |= FLAG_PENDING_VALUE;
  node.flags &= ~(FLAG_NEEDS_COMMIT | FLAG_DELETED_PROPERTY);
}

function shallowClone<T extends object>(target: T): T {
  if (Array.isArray(target)) {
    return target.slice() as T;
  } else {
    return { ...target, __proto__: Object.getPrototypeOf(target) };
  }
}
