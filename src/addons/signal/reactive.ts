import { isObject } from '../../compare.js';
import {
  Atom,
  Computed,
  Signal,
  type Subscriber,
  type Unsubscribe,
} from './signal.js';

const UNWRAP_TAG = Symbol();

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
  version: number;
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
    return this._node.version;
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
    const { value, version } = this._node.signal;
    if (!isObject(value)) {
      return undefined;
    }
    const child = getChild(this._node, normalizeKey(key), value, version);
    return new Reactive(child, options);
  }

  scope<TResult>(callback: (draft: T) => TResult): TResult {
    const { value, version } = this._node.signal;
    return callback(
      isObject(value) ? createDraft(this._node, value, version) : value,
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

export function unwrap<T>(draft: T): T {
  return (draft as any)?.[UNWRAP_TAG] ?? draft;
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
  parent: ReactiveNode<T>,
  targetValue: T & object,
  targetVersion: number,
  finalizeValue: typeof commitValue = commitValue,
  chainValue: typeof createDraft = createDraft,
): T {
  const { signal } = parent;
  if (signal instanceof Atom) {
    return new Proxy(targetValue, {
      deleteProperty(_target, key) {
        const child = getChild(parent, key, targetValue, targetVersion);
        if (parent.signal.version === targetVersion) {
          signal.invalidate({
            type: 'delete',
            source: child.signal,
            path: [key],
          });
          parent.flags |= FLAG_DIRTY_VALUE;
          child.flags |= FLAG_DELETED_PROPERTY;
          parent.version++;
        }
        return true;
      },
      get(target, key, receiver) {
        if (key === UNWRAP_TAG) {
          return commitValue(parent);
        } else {
          const child = getChild(parent, key, targetValue, targetVersion);
          if (child.flags & FLAG_DELETED_PROPERTY) {
            return undefined;
          }
          if (
            !(child.flags & (FLAG_PENDING_VALUE | FLAG_ENUMERABLE_PROPERTY))
          ) {
            return Reflect.get(target, key, receiver);
          }
          const { value, version } = child.signal;
          if (!isObject(value)) {
            return finalizeValue(child);
          }
          return chainValue(child, value, version);
        }
      },
      getOwnPropertyDescriptor(target, key) {
        const child = getChild(parent, key, targetValue, targetVersion);
        if (child.flags & FLAG_DELETED_PROPERTY) {
          return undefined;
        }
        if (child.flags & FLAG_DYNAMIC_PROPERTY) {
          return {
            value: child.signal.value,
            writable: true,
            enumerable: true,
            configurable: true,
          };
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
      set(_target, key, value, _receiver) {
        const prop = getChild(parent, key, targetValue, targetVersion);
        setPendingValue(prop, value);
        return true;
      },
      has(target, key) {
        const child = parent.children?.get(key);
        return child !== undefined
          ? !(child.flags & FLAG_DELETED_PROPERTY)
          : Reflect.has(target, key);
      },
      ownKeys(target) {
        const baseKeys = Reflect.ownKeys(target);
        if (parent.children !== null) {
          const dynamicKeys: NormalizedKey[] = [];
          const deletedKeys: NormalizedKey[] = [];
          for (const [key, child] of parent.children.entries()) {
            if (child.flags & FLAG_DELETED_PROPERTY) {
              deletedKeys.push(key);
            } else if (child.flags & FLAG_DYNAMIC_PROPERTY) {
              dynamicKeys.push(key);
            }
          }
          if (dynamicKeys.length > 0 || deletedKeys.length > 0) {
            return [
              ...new Set(baseKeys)
                .difference(new Set(deletedKeys))
                .union(new Set(dynamicKeys)),
            ];
          }
        }
        return baseKeys;
      },
    });
  } else {
    return targetValue;
  }
}

function createNode<T>(signal: Signal<T>, flags = NO_FLAGS): ReactiveNode<T> {
  return {
    signal,
    children: null,
    version: 0,
    flags,
  };
}

function getChild<T>(
  parent: ReactiveNode<T>,
  key: NormalizedKey,
  targetValue: T & object,
  targetVersion: number,
): ReactiveNode<unknown> {
  let child = parent.children?.get(key);

  if (child === undefined) {
    child = resolveChild(parent, key, targetValue, targetVersion);

    if (child.signal instanceof Atom) {
      child.signal.subscribe((event) => {
        if (parent.signal.version === targetVersion) {
          // SAFETY: When the child is Atom, the parent is also Atom.
          (parent.signal as Atom<T>).invalidate({
            ...event,
            get path() {
              return [key, ...event.path];
            },
          });
          parent.flags |= FLAG_DIRTY_VALUE;
          parent.version++;
        }
      });
    }

    parent.children ??= new Map();
    parent.children.set(key, child);
  }

  return child;
}

function normalizeKey(key: PropertyKey): NormalizedKey {
  return typeof key === 'number' ? key.toString() : key;
}

function resolveChild<T>(
  parent: ReactiveNode<T>,
  key: PropertyKey,
  targetValue: T & object,
  targetVersion: number,
): ReactiveNode<unknown> {
  let proto = targetValue;
  do {
    const descriptor = Object.getOwnPropertyDescriptor(proto, key);
    if (descriptor !== undefined) {
      const { get, set, value, enumerable } = descriptor;
      const flags = enumerable ? FLAG_ENUMERABLE_PROPERTY : NO_FLAGS;
      if (get !== undefined) {
        if (set !== undefined) {
          return createNode(
            new Atom(get.call(createDraft(parent, targetValue, targetVersion))),
            flags,
          );
        } else {
          const dependencies: Signal<unknown>[] = [];
          const initialResult = get.call(
            createDraft(
              parent,
              targetValue,
              targetVersion,
              (child) => {
                dependencies.push(child.signal as Signal<unknown>);
                return commitValue(child);
              },
              (child, value, version) => {
                dependencies.push(child.signal as Signal<unknown>);
                return createDraft(child, value, version);
              },
            ),
          );
          const initialVersion = dependencies.reduce(
            (version, dependency) => version + dependency.version,
            0,
          );
          return createNode(
            new Computed(
              () => get.call(createDraft(parent, targetValue, targetVersion)),
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
}

function setPendingValue<T>(node: ReactiveNode<T>, newValue: T): void {
  // Intentionally throws a TypeError if signal is a Computed (which has no setter).
  (node.signal as Atom<T>).value = newValue;
  node.children?.clear();
  node.flags |= FLAG_PENDING_VALUE;
  node.flags &= ~(FLAG_NEEDS_COMMIT | FLAG_DELETED_PROPERTY);
  node.version++;
}

function shallowClone<T extends object>(target: T): T {
  if (Array.isArray(target)) {
    return target.slice() as T;
  } else {
    return { ...target, __proto__: Object.getPrototypeOf(target) };
  }
}
