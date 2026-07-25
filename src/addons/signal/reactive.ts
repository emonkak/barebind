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

type Get<T, K extends keyof T> =
  IsIndexAccess<T, K> extends true ? T[K] | undefined : T[K];

type IsIndexAccess<T, K extends PropertyKey> = string extends keyof T
  ? K extends string
    ? true
    : false
  : number extends keyof T
    ? K extends number
      ? true
      : false
    : symbol extends keyof T
      ? K extends symbol
        ? true
        : false
      : false;

type NonPrimitive<T> = Exclude<T, Primitive>;

type NormalizedKey = string | symbol;

type Primitive = bigint | string | number | symbol | null | undefined;

export class Reactive<T> extends Signal<T> {
  /** @internal */
  _signal: Signal<T>;
  /** @internal */
  _owner: Reactive<unknown> | null;
  /** @internal */
  _path: PropertyKey[];
  /** @internal */
  _flags: number;
  /** @internal */
  _properties: Map<NormalizedKey, Reactive<unknown>> | null = null;

  static from<T>(value: T): Reactive<T> {
    return new Reactive(new Atom(value), null, [], NO_FLAGS);
  }

  constructor(
    signal: Signal<T>,
    owner: Reactive<unknown> | null,
    path: PropertyKey[],
    flags: number,
  ) {
    super();
    this._signal = signal;
    this._path = path;
    this._owner = owner;
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
  ): T extends Primitive ? undefined : Reactive<Get<NonPrimitive<T>, K>>;
  get(key: PropertyKey): T extends Primitive ? undefined : Reactive<unknown>;
  get(key: PropertyKey): Reactive<any> | undefined {
    const target = this._signal.value;
    return isNonPrimitive(target)
      ? getProperty(this, normalizeKey(key), target)
      : undefined;
  }

  scope<TResult>(callback: (draft: T) => TResult): TResult {
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
  let value = receiver._signal.value;
  if (receiver._flags & FLAG_NEEDS_COMMIT) {
    value = shallowClone(value);
    for (const [key, prop] of receiver._properties!.entries()) {
      if (prop._flags & FLAG_DELETED_PROPERTY) {
        delete (value as any)[key];
      } else if (prop._flags & FLAG_PENDING_VALUE) {
        (value as any)[key] = prop.value;
        prop._flags &= ~FLAG_PENDING_VALUE;
      }
    }
    (receiver._signal as WritableSignal<T>).write(value);
    receiver._flags &= ~FLAG_NEEDS_COMMIT;
  }
  return value;
}

function createDraft<T>(
  receiver: Reactive<T>,
  target: T & object,
  commit: typeof commitValue = commitValue,
): { proxy: T; revoke: () => void } {
  return Proxy.revocable(target, {
    deleteProperty(target, key) {
      const prop = getProperty(receiver, key, target);
      deleteProperty(prop);
      return true;
    },
    get(target, key, _proxy) {
      const prop = getProperty(receiver, key, target);
      if (prop._flags & FLAG_DELETED_PROPERTY) {
        return undefined;
      }
      return commit(prop);
    },
    getOwnPropertyDescriptor(target, key) {
      const prop = getProperty(receiver, key, target);
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
    set(target, key, value, _proxy) {
      const prop = getProperty(receiver, key, target);
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
        const dynamicKeys: NormalizedKey[] = [];
        const deletedKeys: NormalizedKey[] = [];
        for (const [key, prop] of receiver._properties.entries()) {
          if (prop._flags & FLAG_DELETED_PROPERTY) {
            deletedKeys.push(key);
          } else if (prop._flags & FLAG_DYNAMIC_PROPERTY) {
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
}

function deleteProperty<T>(prop: Reactive<T>): void {
  for (
    let owner = prop._owner, level = 1;
    owner !== null;
    owner = owner._owner
  ) {
    if (owner._signal instanceof WritableSignal) {
      owner._signal.invalidate({
        type: 'delete',
        source: prop._signal,
        get path() {
          return prop._path.slice(-level);
        },
      });
    }
    owner._flags |= FLAG_DIRTY_VALUE;
    level++;
  }
  prop._flags |= FLAG_DELETED_PROPERTY;
}

function getProperty<T>(
  receiver: Reactive<T>,
  key: NormalizedKey,
  target: T & object,
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
  key: PropertyKey,
): Reactive<unknown> {
  const path = receiver._path.concat(key);
  const descriptor = getPropertyDescriptor(target, key);

  if (descriptor === undefined) {
    return new Reactive(
      new Atom<unknown>(undefined),
      receiver as Reactive<unknown>,
      path,
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
      receiver as Reactive<unknown>,
      path,
      flags,
    );
  }

  if (get !== undefined) {
    const { proxy, revoke } = createDraft(receiver, target, (prop) => {
      dependencies.push(prop);
      return commitValue(prop);
    });
    const dependencies: Signal<any>[] = [];
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
        receiver as Reactive<unknown>,
        path,
        flags,
      );
    } finally {
      revoke();
    }
  }

  return new Reactive(
    new Atom(value),
    receiver as Reactive<unknown>,
    path,
    flags,
  );
}

function setPendingValue<T>(receiver: Reactive<T>, newValue: T): void {
  const oldValue = receiver._signal.value;
  (receiver._signal as WritableSignal<T>).value = newValue;
  for (
    let owner = receiver._owner, level = 1;
    owner !== null;
    owner = owner._owner
  ) {
    if (owner._signal instanceof WritableSignal) {
      owner._signal.invalidate({
        type: 'set',
        source: receiver._signal,
        get path() {
          return receiver._path.slice(-level);
        },
        oldValue,
        newValue,
      });
    }
    owner._flags |= FLAG_DIRTY_VALUE;
    level++;
  }
  if (receiver._properties !== null) {
    for (const prop of receiver._properties.values()) {
      prop._owner = null;
    }
    receiver._properties.clear();
  }
  receiver._flags |= FLAG_PENDING_VALUE;
  receiver._flags &= ~FLAG_NEEDS_COMMIT;
}

function shallowClone<T>(target: T): T {
  return Array.isArray(target)
    ? (target.slice() as T)
    : { ...target, __proto__: Object.getPrototypeOf(target) };
}
