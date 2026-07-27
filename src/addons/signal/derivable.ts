import {
  Accessor,
  Atom,
  Computed,
  Signal,
  type Subscriber,
  type Unsubscribe,
  WritableSignal,
} from './signal.js';

const UNWRAP_TAG = Symbol();

const NO_FLAGS /*                   */ = 0;
const FLAG_NEEDS_COMMIT /*          */ = 0b0000001;
const FLAG_PENDING_VALUE /*         */ = 0b0000010;
const FLAG_DIRTY_VALUE /*           */ = 0b0000011;
const FLAG_CONFIGURABLE_PROPERTY /* */ = 0b0000100;
const FLAG_ENUMERABLE_PROPERTY /*   */ = 0b0001000;
const FLAG_WRITABLE_PROPERTY /*     */ = 0b0010000;
const FLAG_DYNAMIC_PROPERTY /*      */ = 0b0100000;
const FLAG_DELETED_PROPERTY /*      */ = 0b1000000;

type Get<T, K extends keyof T, P = PropertyKey> = P extends keyof T
  ? K extends P
    ? T[K] | undefined
    : T[K]
  : T[K];

type NonPrimitive<T> = Exclude<T, Primitive>;

type NormalizedKey = string | symbol;

type Primitive = bigint | string | number | symbol | null | undefined;

export class Derivable<T> extends Signal<T> {
  /** @internal */
  _signal: Signal<T>;
  /** @internal */
  _owner: Derivable<unknown> | null;
  /** @internal */
  _key: NormalizedKey | null;
  /** @internal */
  _flags: number;
  /** @internal */
  _properties: Map<NormalizedKey, Derivable<unknown>> | null = null;

  static from<T>(value: T): Derivable<T> {
    return new Derivable(new Atom(value), null, null, NO_FLAGS);
  }

  constructor(
    signal: Signal<T>,
    owner: Derivable<any> | null,
    key: NormalizedKey | null,
    flags: number,
  ) {
    super();
    this._signal = signal;
    this._owner = owner;
    this._key = key;
    this._flags = flags;
  }

  get version(): number {
    return this._signal.version;
  }

  get value(): T {
    return commitValue(this);
  }

  set value(newValue: T) {
    setPendingValue(this, newValue);
  }

  delete(): void {
    deleteProperty(this);
  }

  get<K extends keyof NonPrimitive<T>>(
    key: K,
  ): T extends object ? Derivable<Get<NonPrimitive<T>, K>> : undefined;
  get(key: PropertyKey): T extends object ? Derivable<unknown> : undefined;
  get(key: PropertyKey): Derivable<any> | undefined {
    const target = this._signal.value;
    return isNonPrimitive(target)
      ? getProperty(this, target, normalizeKey(key))
      : undefined;
  }

  scope<TReturn>(callback: (value: T) => TReturn): TReturn {
    const target = this._signal.value;
    if (isNonPrimitive(target)) {
      const { proxy, revoke } = trapTarget(this, target);
      try {
        return callback(proxy);
      } finally {
        revoke();
      }
    } else {
      return callback(target);
    }
  }

  subscribe(subscriber: Subscriber): Unsubscribe {
    return this._signal.subscribe(subscriber);
  }
}

export function unwrap<T>(value: T): T {
  return (value as any)?.[UNWRAP_TAG] ?? value;
}

function commitTarget<T>(receiver: Derivable<T>): {
  proxy: T;
  revoke: () => void;
} {
  return {
    proxy: commitValue(receiver),
    revoke: () => {},
  };
}

function commitValue<T>(receiver: Derivable<T>): T {
  let pendingValue = receiver._signal.value;
  if (receiver._flags & FLAG_NEEDS_COMMIT) {
    pendingValue = shallowClone(pendingValue);
    for (const [key, prop] of receiver._properties!.entries()) {
      if (prop._flags & FLAG_DELETED_PROPERTY) {
        delete (pendingValue as any)[key];
      } else if (prop._flags & FLAG_PENDING_VALUE) {
        (pendingValue as any)[key] = prop.value;
        prop._flags &= ~FLAG_PENDING_VALUE;
      }
    }
    // SAFETY: The signal is always WritableSignal if FLAG_NEEDS_COMMIT is set.
    (receiver._signal as WritableSignal<T>).write(pendingValue);
    receiver._flags &= ~FLAG_NEEDS_COMMIT;
  }
  return pendingValue;
}

function deleteProperty<T>(prop: Derivable<T>): void {
  for (
    let owner = prop._owner, reversePath = [prop._key!];
    owner !== null;
    owner = owner._owner
  ) {
    if (owner._signal instanceof WritableSignal) {
      const level = reversePath.length;
      owner._signal.invalidate({
        type: 'delete',
        source: prop._signal,
        get path() {
          return reversePath.slice(0, level).reverse();
        },
      });
    }
    owner._flags |= FLAG_DIRTY_VALUE;
    reversePath.push(owner._key!);
  }
  prop._flags |= FLAG_DELETED_PROPERTY;
}

function getProperty<T>(
  receiver: Derivable<T>,
  target: T & object,
  key: NormalizedKey,
): Derivable<unknown> {
  let prop = receiver._properties?.get(key);
  if (prop === undefined) {
    prop = resolveProperty(receiver, target, key);
    receiver._properties ??= new Map();
    receiver._properties.set(key, prop);
  }
  return prop;
}

function getPropertyDescriptor(
  target: object,
  key: PropertyKey,
): PropertyDescriptor | undefined {
  let descriptor: PropertyDescriptor | undefined;
  do {
    descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (descriptor !== undefined) {
      break;
    }
    target = Object.getPrototypeOf(target);
  } while (target !== null);
  return descriptor;
}

function getPropertyFlags(descriptor: PropertyDescriptor): number {
  let flags = NO_FLAGS;
  if (descriptor.configurable) {
    flags |= FLAG_CONFIGURABLE_PROPERTY;
  }
  if (descriptor.enumerable) {
    flags |= FLAG_ENUMERABLE_PROPERTY;
  }
  if (descriptor.writable) {
    flags |= FLAG_WRITABLE_PROPERTY;
  }
  return flags;
}

function isNonPrimitive(value: unknown): value is object {
  return (
    value !== null && (typeof value === 'object' || typeof value === 'function')
  );
}

function normalizeKey(key: PropertyKey): NormalizedKey {
  return typeof key === 'number' ? key.toString() : key;
}

function resolveProperty<T>(
  receiver: Derivable<T>,
  target: T & object,
  key: NormalizedKey,
): Derivable<unknown> {
  const descriptor = getPropertyDescriptor(target, key);

  if (descriptor === undefined) {
    return new Derivable(
      new Atom<unknown>(undefined),
      receiver,
      key,
      FLAG_CONFIGURABLE_PROPERTY |
        FLAG_ENUMERABLE_PROPERTY |
        FLAG_WRITABLE_PROPERTY |
        FLAG_DYNAMIC_PROPERTY,
    );
  }

  const { get, set, value } = descriptor;
  const flags = getPropertyFlags(descriptor);

  if (get !== undefined && set !== undefined) {
    return new Derivable(
      new Accessor(
        () => {
          const { proxy, revoke } = trapTarget(receiver, target, commitTarget);
          try {
            return get.call(proxy);
          } finally {
            revoke();
          }
        },
        (newValue) => {
          const { proxy, revoke } = trapTarget(receiver, target, commitTarget);
          try {
            set.call(proxy, newValue);
          } finally {
            revoke();
          }
        },
      ),
      receiver,
      key,
      flags,
    );
  }

  if (get !== undefined) {
    const dependencies: Signal<any>[] = [];
    const { proxy, revoke } = trapTarget(
      receiver,
      target,
      (prop) => {
        dependencies.push(prop);
        return commitTarget(prop);
      },
      (prop) => {
        dependencies.push(prop);
        return commitValue(prop);
      },
    );
    try {
      const initialResult = get.call(proxy);
      const initialVersion = dependencies.reduce(
        (version, dependency) => version + dependency.version,
        0,
      );
      return new Derivable(
        new Computed(
          () => {
            const { proxy, revoke } = trapTarget(
              receiver,
              target,
              commitTarget,
            );
            try {
              return get.call(proxy);
            } finally {
              revoke();
            }
          },
          dependencies,
          initialResult,
          initialVersion,
        ),
        receiver,
        key,
        flags,
      );
    } finally {
      revoke();
    }
  }

  return new Derivable(new Atom(value), receiver, key, flags);
}

function setPendingValue<T>(receiver: Derivable<T>, newValue: T): void {
  const oldValue = receiver._signal.value;
  // Intentionally throws a TypeError if signal is a Computed (which has no setter).
  (receiver._signal as WritableSignal<T>).value = newValue;
  for (
    let owner = receiver._owner, reversePath = [receiver._key!];
    owner !== null;
    owner = owner._owner
  ) {
    if (owner._signal instanceof WritableSignal) {
      const level = reversePath.length;
      owner._signal.invalidate({
        type: 'set',
        source: receiver._signal,
        get path() {
          return reversePath.slice(0, level).reverse();
        },
        oldValue,
        newValue,
      });
    }
    owner._flags |= FLAG_DIRTY_VALUE;
    reversePath.push(owner._key!);
  }
  if (receiver._properties !== null) {
    for (const prop of receiver._properties.values()) {
      prop._owner = null;
    }
    receiver._properties.clear();
  }
  receiver._flags |= FLAG_PENDING_VALUE;
  receiver._flags &= ~(FLAG_NEEDS_COMMIT | FLAG_DELETED_PROPERTY);
}

function shallowClone<T>(target: T): T {
  return Array.isArray(target)
    ? (target.slice() as T)
    : Object.create(
        Object.getPrototypeOf(target),
        Object.getOwnPropertyDescriptors(target),
      );
}

function trapTarget<T>(
  receiver: Derivable<T>,
  target: T & object,
  wrap: typeof trapTarget = trapTarget,
  finalize: typeof commitValue = commitValue,
): { proxy: T; revoke: () => void } {
  const { proxy, revoke } = Proxy.revocable(target, {
    deleteProperty(target, key) {
      const prop = getProperty(receiver, target, key);
      const success = !!(prop._flags & FLAG_CONFIGURABLE_PROPERTY);
      if (success) {
        deleteProperty(prop);
      }
      return success;
    },
    get(target, key, _proxyReceiver) {
      if (key === UNWRAP_TAG) {
        return finalize(receiver);
      }
      const prop = getProperty(receiver, target, key);
      if (prop._flags & FLAG_DELETED_PROPERTY) {
        return undefined;
      }
      if (prop._flags & FLAG_ENUMERABLE_PROPERTY) {
        const target = prop._signal.value;
        if (isNonPrimitive(target)) {
          const { proxy, revoke } = wrap(prop, target);
          revokeFunctions.push(revoke);
          return proxy;
        }
      }
      return finalize(prop);
    },
    getOwnPropertyDescriptor(target, key) {
      const prop = getProperty(receiver, target, key);
      if (prop._flags & FLAG_DELETED_PROPERTY) {
        return undefined;
      }
      if (prop._flags & FLAG_DYNAMIC_PROPERTY) {
        return {
          value: prop._signal.value,
          writable: true,
          enumerable: true,
          configurable: true,
        };
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
    set(target, key, value, _proxyReceiver) {
      const prop = getProperty(receiver, target, key);
      const success = !!(prop._flags & FLAG_WRITABLE_PROPERTY);
      if (success) {
        setPendingValue(prop, value);
      }
      return success;
    },
    has(target, key) {
      const prop = receiver._properties?.get(key);
      return prop !== undefined
        ? !(prop._flags & FLAG_DELETED_PROPERTY)
        : Reflect.has(target, key);
    },
    ownKeys(target) {
      const baseKeys = Reflect.ownKeys(target);
      if (receiver._properties !== null) {
        const deletedKeys: NormalizedKey[] = [];
        const dynamicKeys: NormalizedKey[] = [];
        for (const [key, prop] of receiver._properties.entries()) {
          if (prop._flags & FLAG_DELETED_PROPERTY) {
            deletedKeys.push(key);
          } else if (prop._flags & FLAG_DYNAMIC_PROPERTY) {
            dynamicKeys.push(key);
          }
        }
        if (deletedKeys.length > 0 || dynamicKeys.length > 0) {
          const derivedKeys = new Set(baseKeys);
          for (const key of deletedKeys) {
            derivedKeys.delete(key);
          }
          for (const key of dynamicKeys) {
            derivedKeys.add(key);
          }
          return [...derivedKeys];
        }
      }
      return baseKeys;
    },
  });
  const revokeFunctions = [revoke];
  return {
    proxy,
    revoke: () => {
      for (const revoke of revokeFunctions) {
        revoke();
      }
    },
  };
}
