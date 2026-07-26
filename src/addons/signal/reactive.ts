import {
  Accessor,
  Atom,
  Computed,
  Signal,
  type Subscriber,
  type Unsubscribe,
  WritableSignal,
} from './signal.js';

const NO_FLAGS /*               */ = 0;
const FLAG_NEEDS_COMMIT /*      */ = 0b00001;
const FLAG_PENDING_VALUE /*     */ = 0b00010;
const FLAG_DIRTY_VALUE /*       */ = 0b00011;
const FLAG_WRITABLE_PROPERTY /* */ = 0b00100;
const FLAG_DYNAMIC_PROPERTY /*  */ = 0b01000;
const FLAG_DELETED_PROPERTY /*  */ = 0b10000;

type Get<T, K extends keyof T, P = PropertyKey> = P extends keyof T
  ? K extends P
    ? T[K] | undefined
    : T[K]
  : T[K];

type NonPrimitive<T> = Exclude<T, Primitive>;

type NormalizedKey = string | symbol;

type Primitive = bigint | string | number | symbol | null | undefined;

export class Reactive<T> extends Signal<T> {
  /** @internal */
  _signal: Signal<T>;
  /** @internal */
  _owner: Reactive<unknown> | null;
  /** @internal */
  _key: NormalizedKey | null;
  /** @internal */
  _flags: number;
  /** @internal */
  _properties: Map<NormalizedKey, Reactive<unknown>> | null = null;

  static from<T>(value: T): Reactive<T> {
    return new Reactive(new Atom(value), null, null, NO_FLAGS);
  }

  constructor(
    signal: Signal<T>,
    owner: Reactive<any> | null,
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

  get<K extends keyof NonPrimitive<T>>(
    key: K,
  ): T extends object ? Reactive<Get<NonPrimitive<T>, K>> : undefined;
  get(key: PropertyKey): T extends object ? Reactive<unknown> : undefined;
  get(key: PropertyKey): Reactive<any> | undefined {
    const target = this._signal.value;
    return isNonPrimitive(target)
      ? getProperty(this, target, normalizeKey(key))
      : undefined;
  }

  scope<TReturn>(callback: (draft: T) => TReturn): TReturn {
    const target = this._signal.value;
    if (isNonPrimitive(target)) {
      const { proxy, revoke } = createDraft(this, target);
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

function commitValue<T>(receiver: Reactive<T>): T {
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
    (receiver._signal as WritableSignal<T>).write(pendingValue);
    receiver._flags &= ~FLAG_NEEDS_COMMIT;
  }
  return pendingValue;
}

function createDraft<T>(
  receiver: Reactive<T>,
  target: T & object,
  commit: typeof commitValue = commitValue,
): { proxy: T; revoke: () => void } {
  return Proxy.revocable(target, {
    deleteProperty(target, key) {
      const prop = getProperty(receiver, target, key);
      deleteProperty(prop);
      return !!(prop._flags & FLAG_WRITABLE_PROPERTY);
    },
    get(target, key, _proxyReceiver) {
      const prop = getProperty(receiver, target, key);
      if (prop._flags & FLAG_DELETED_PROPERTY) {
        return undefined;
      }
      return commit(prop);
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
      setPendingValue(prop, value);
      return !!(prop._flags & FLAG_WRITABLE_PROPERTY);
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
          const uniqueKeys = new Set(baseKeys);
          for (const key of deletedKeys) {
            uniqueKeys.delete(key);
          }
          for (const key of dynamicKeys) {
            uniqueKeys.add(key);
          }
          return [...uniqueKeys];
        }
      }
      return baseKeys;
    },
  });
}

function deleteProperty<T>(prop: Reactive<T>): void {
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
  receiver: Reactive<T>,
  target: T & object,
  key: NormalizedKey,
): Reactive<unknown> {
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
  if (descriptor.writable ?? true) {
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
  receiver: Reactive<T>,
  target: T & object,
  key: NormalizedKey,
): Reactive<unknown> {
  const descriptor = getPropertyDescriptor(target, key);

  if (descriptor === undefined) {
    return new Reactive(
      new Atom<unknown>(undefined),
      receiver,
      key,
      FLAG_WRITABLE_PROPERTY | FLAG_DYNAMIC_PROPERTY,
    );
  }

  const { get, set, value } = descriptor;
  const flags = getPropertyFlags(descriptor);

  if (get !== undefined && set !== undefined) {
    return new Reactive(
      new Accessor(
        () => {
          const { proxy, revoke } = createDraft(receiver, target);
          try {
            return get.call(proxy);
          } finally {
            revoke();
          }
        },
        (newValue) => {
          const { proxy, revoke } = createDraft(receiver, target);
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
    const { proxy, revoke } = createDraft(receiver, target, (prop) => {
      dependencies.push(prop);
      return commitValue(prop);
    });
    try {
      const initialResult = get.call(proxy);
      const initialVersion = dependencies.reduce(
        (version, dependency) => version + dependency.version,
        0,
      );
      return new Reactive(
        new Computed(
          () => {
            const { proxy, revoke } = createDraft(receiver, target);
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

  return new Reactive(new Atom(value), receiver, key, flags);
}

function setPendingValue<T>(receiver: Reactive<T>, newValue: T): void {
  const oldValue = receiver._signal.value;
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
    : { ...target, __proto__: Object.getPrototypeOf(target) };
}
