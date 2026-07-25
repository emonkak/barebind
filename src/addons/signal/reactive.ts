import {
  Accessor,
  Atom,
  Computed,
  Signal,
  type Subscriber,
  type Unsubscribe,
  WritableSignal,
} from './signal.js';

const NO_FLAGS /*              */ = 0;
const FLAG_NEEDS_COMMIT /*     */ = 0b0001;
const FLAG_PENDING_VALUE /*    */ = 0b0010;
const FLAG_DIRTY_VALUE /*      */ = 0b0011;
const FLAG_DYNAMIC_PROPERTY /* */ = 0b0100;
const FLAG_DELETED_PROPERTY /* */ = 0b1000;

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
  _signal: Signal<T>;
  _path: PropertyKey[];
  _parent: Reactive<unknown> | null;
  _flags: number;
  _children: Map<NormalizedKey, Reactive<unknown>> | null = null;

  static from<T>(value: T): Reactive<T> {
    return new Reactive(new Atom(value), [], null);
  }

  constructor(
    signal: Signal<T>,
    path: PropertyKey[],
    parent: Reactive<unknown> | null,
    flags: number = NO_FLAGS,
  ) {
    super();
    this._signal = signal;
    this._path = path;
    this._parent = parent;
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
      ? getChild(this, normalizeKey(key), target)
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

function commitValue<T>(reactive: Reactive<T>): T {
  let value = reactive._signal.value;
  if (reactive._flags & FLAG_NEEDS_COMMIT) {
    value = shallowClone(value);
    for (const [key, child] of reactive._children!.entries()) {
      if (child._flags & FLAG_DELETED_PROPERTY) {
        delete (value as any)[key];
      } else if (child._flags & FLAG_PENDING_VALUE) {
        (value as any)[key] = child.value;
        child._flags &= ~FLAG_PENDING_VALUE;
      }
    }
    (reactive._signal as WritableSignal<T>).write(value);
    reactive._flags &= ~FLAG_NEEDS_COMMIT;
  }
  return value;
}

function createDraft<T>(
  parent: Reactive<T>,
  target: T & object,
  commit: typeof commitValue = commitValue,
): { proxy: T; revoke: () => void } {
  return Proxy.revocable(target, {
    deleteProperty(target, key) {
      const child = getChild(parent, key, target);
      deleteProperty(child);
      return true;
    },
    get(target, key, _receiver) {
      const child = getChild(parent, key, target);
      if (child._flags & FLAG_DELETED_PROPERTY) {
        return undefined;
      }
      return commit(child);
    },
    getOwnPropertyDescriptor(target, key) {
      const child = getChild(parent, key, target);
      if (child._flags & FLAG_DELETED_PROPERTY) {
        return undefined;
      }
      if (child._flags & FLAG_DYNAMIC_PROPERTY) {
        return {
          value: child._signal.value,
          writable: true,
          enumerable: true,
          configurable: true,
        };
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
    set(target, key, value, _receiver) {
      const child = getChild(parent, key, target);
      child.value = value;
      return true;
    },
    has(target, key) {
      const child = parent._children?.get(key);
      return child !== undefined
        ? !(child._flags & FLAG_DELETED_PROPERTY)
        : Reflect.has(target, key);
    },
    ownKeys(target) {
      const baseKeys = Reflect.ownKeys(target);
      if (parent._children !== null) {
        const dynamicKeys: NormalizedKey[] = [];
        const deletedKeys: NormalizedKey[] = [];
        for (const [key, child] of parent._children.entries()) {
          if (child._flags & FLAG_DELETED_PROPERTY) {
            deletedKeys.push(key);
          } else if (child._flags & FLAG_DYNAMIC_PROPERTY) {
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

function deleteProperty<T>(reactive: Reactive<T>): void {
  for (
    let parent = reactive._parent, level = 1;
    parent !== null;
    parent = parent._parent
  ) {
    if (parent._signal instanceof WritableSignal) {
      parent._signal.invalidate({
        type: 'delete',
        source: reactive._signal,
        get path() {
          return reactive._path.slice(-level);
        },
      });
    }
    parent._flags |= FLAG_DIRTY_VALUE;
    level++;
  }
  reactive._flags |= FLAG_DELETED_PROPERTY;
}

function getChild<T>(
  reactive: Reactive<T>,
  key: NormalizedKey,
  target: T & object,
): Reactive<unknown> {
  let child = reactive._children?.get(key);
  if (child === undefined) {
    child = resolveChild(reactive, target, key);
    reactive._children ??= new Map();
    reactive._children.set(key, child);
  }
  return child;
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

function isNonPrimitive(value: unknown): value is object {
  return (
    value !== null && (typeof value === 'object' || typeof value === 'function')
  );
}

function normalizeKey(key: PropertyKey): NormalizedKey {
  return typeof key === 'number' ? key.toString() : key;
}

function resolveChild<T>(
  parent: Reactive<T>,
  target: T & object,
  key: PropertyKey,
): Reactive<unknown> {
  const descriptor = getPropertyDescriptor(target, key);
  const path = parent._path.concat(key);

  if (descriptor === undefined) {
    return new Reactive(
      new Atom<unknown>(undefined),
      path,
      parent as Reactive<unknown>,
      FLAG_DYNAMIC_PROPERTY,
    );
  }

  const { get, set, value } = descriptor;

  if (get !== undefined && set !== undefined) {
    return new Reactive(
      new Accessor(
        () => {
          const { proxy, revoke } = createDraft(parent, target);
          try {
            return get.call(proxy);
          } finally {
            revoke();
          }
        },
        (newValue) => {
          const { proxy, revoke } = createDraft(parent, target);
          try {
            set.call(proxy, newValue);
          } finally {
            revoke();
          }
        },
      ),
      path,
      parent as Reactive<unknown>,
    );
  }

  if (get !== undefined) {
    const { proxy, revoke } = createDraft(parent, target, (child) => {
      dependencies.push(child);
      return commitValue(child);
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
            const { proxy, revoke } = createDraft(parent, target);
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
        path,
        parent as Reactive<unknown>,
      );
    } finally {
      revoke();
    }
  }

  return new Reactive(new Atom(value), path, parent as Reactive<unknown>);
}

function setPendingValue<T>(reactive: Reactive<T>, newValue: T): void {
  const oldValue = reactive._signal.value;
  (reactive._signal as WritableSignal<T>).value = newValue;
  for (
    let parent = reactive._parent, level = 1;
    parent !== null;
    parent = parent._parent
  ) {
    if (parent._signal instanceof WritableSignal) {
      parent._signal.invalidate({
        type: 'set',
        source: reactive._signal,
        get path() {
          return reactive._path.slice(-level);
        },
        oldValue,
        newValue,
      });
    }
    parent._flags |= FLAG_DIRTY_VALUE;
    level++;
  }
  if (reactive._children !== null) {
    for (const child of reactive._children.values()) {
      child._parent = null;
    }
    reactive._children.clear();
  }
  reactive._flags |= FLAG_PENDING_VALUE;
  reactive._flags &= ~FLAG_NEEDS_COMMIT;
}

function shallowClone<T>(target: T): T {
  return Array.isArray(target)
    ? (target.slice() as T)
    : { ...target, __proto__: Object.getPrototypeOf(target) };
}
