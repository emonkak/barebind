import {
  $customHook,
  type CustomHookObject,
  type HookContext,
} from '../core.js';
import {
  Atom,
  Computed,
  Signal,
  type Subscriber,
  type Subscription,
} from './signal.js';

const $signalMap = Symbol('$signalMap');

export interface StoreClass<TClass extends Constructable>
  extends CustomHookObject<UseStore<InstanceType<TClass>>> {
  new (...args: ConstructorParameters<TClass>): UseStore<InstanceType<TClass>>;
}

export interface StoreExtensions<TState> extends CustomHookObject<void> {
  readonly [$signalMap]: SignalMap;
  applySnapshot(snapshot: Snapshot<TState>): void;
  asSignal(): Signal<this>;
  getSignal<TKey extends SignalKeys<TState>>(key: TKey): Signal<TState[TKey]>;
  getSignal(key: PropertyKey): Signal<unknown> | undefined;
  getVersion(): number;
  subscribe(subscriber: Subscriber): Subscription;
  toSnapshot(): Snapshot<TState>;
}

export type Snapshot<T> = {
  [K in SnapshotKeys<T>]: T[K] extends StoreExtensions<infer State>
    ? Snapshot<State>
    : T[K];
};

type Constructable<T = object> = new (...args: any[]) => T;

type UseStore<TState> = TState & StoreExtensions<TState>;

type SnapshotKeys<T> = Extract<SignalKeys<T>, WritableKeys<T>>;

type SignalKeys<T> = Exclude<
  Extract<keyof T, string>,
  PrivateKeys | FunctionKeys<T>
>;

type SignalMap = Record<PropertyKey, Signal<unknown>>;

type PrivateKeys = `_${string}`;

type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

type WritableKeys<T> = {
  [K in keyof T]: StrictEqual<
    { -readonly [P in K]-?: T[P] },
    Pick<T, K>
  > extends true
    ? K
    : never;
}[keyof T];

type StrictEqual<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
  T,
>() => T extends Y ? 1 : 2
  ? true
  : false;

export function defineStore<TClass extends Constructable>(
  superclass: TClass,
): StoreClass<TClass> {
  return class Store
    extends superclass
    implements StoreExtensions<InstanceType<TClass>>
  {
    readonly [$signalMap]: SignalMap = Object.create(null, {});

    static [$customHook](
      this: Constructable<Store>,
      context: HookContext,
    ): Store {
      const store = context.getContextValue(this);
      if (!(store instanceof this)) {
        throw new Error(
          `The context value for the store of ${superclass.name} is not registered, please ensure it is registered by context.use(...).`,
        );
      }
      return store;
    }

    constructor(...args: any[]) {
      super(...args);
      defineInstanceProperties(this, this[$signalMap]);
      definePrototypeProperties(superclass, this, this[$signalMap]);
      Object.freeze(this[$signalMap]);
    }

    [$customHook](context: HookContext): void {
      context.setContextValue(this.constructor, this);
    }

    applySnapshot(snapshot: Snapshot<InstanceType<TClass>>): void {
      for (const key of Object.keys(this[$signalMap])) {
        const signal = this[$signalMap][key];

        if (signal instanceof Atom) {
          signal.value = snapshot[key as SnapshotKeys<InstanceType<TClass>>];
        } else if (signal instanceof StoreSignal) {
          signal.value.applySnapshot(
            snapshot[key as SnapshotKeys<InstanceType<TClass>>],
          );
        }
      }
    }

    asSignal(): Signal<this> {
      return new StoreSignal(this);
    }

    getSignal<TKey extends SignalKeys<InstanceType<TClass>>>(
      key: TKey,
    ): Signal<InstanceType<TClass>[TKey]>;
    getSignal(key: PropertyKey): Signal<unknown> | undefined {
      return this[$signalMap][key];
    }

    getVersion(): number {
      const signalMap = this[$signalMap];
      let version = 0;
      for (const key in signalMap) {
        const signal = signalMap[key]!;
        if (signal instanceof Atom || signal instanceof StoreSignal) {
          version += signal.version;
        }
      }
      return version;
    }

    subscribe(subscriber: Subscriber): Subscription {
      const signalMap = this[$signalMap];
      const subscriptions: Subscription[] = [];

      for (const key in signalMap) {
        const signal = signalMap[key]!;
        if (signal instanceof Atom || signal instanceof StoreSignal) {
          const subscription = signal.subscribe(subscriber);
          subscriptions.push(subscription);
        }
      }

      return () => {
        for (let i = 0, l = subscriptions.length; i < l; i++) {
          subscriptions[i]!();
        }
      };
    }

    toSnapshot(): Snapshot<InstanceType<TClass>> {
      const snapshot: Record<PropertyKey, unknown> = {};

      for (const key of Object.keys(this[$signalMap])) {
        const signal = this[$signalMap][key];
        if (signal instanceof Atom) {
          snapshot[key] = signal.value;
        } else if (signal instanceof StoreSignal) {
          snapshot[key] = signal.value.toSnapshot();
        }
      }

      return snapshot as Snapshot<InstanceType<TClass>>;
    }
  } as unknown as StoreClass<TClass>;
}

class StoreSignal<
  TStore extends StoreExtensions<unknown>,
> extends Signal<TStore> {
  private readonly _store: TStore;

  constructor(store: TStore) {
    super();
    this._store = store;
  }

  get value(): TStore {
    return this._store;
  }

  get version(): number {
    return this._store.getVersion();
  }

  subscribe(subscriber: Subscriber): Subscription {
    return this._store.subscribe(subscriber);
  }
}

function defineInstanceProperties<T extends object>(
  instance: T,
  signalMap: SignalMap,
): void {
  const descriptors = Object.getOwnPropertyDescriptors(instance);

  for (const key in descriptors) {
    const { writable, enumerable, configurable, value } = descriptors[key]!;

    if (writable && configurable && !key.startsWith('_')) {
      if (isStore(value)) {
        const signal = new StoreSignal(value);
        signalMap[key] = signal;
        Object.defineProperty(instance, key, {
          configurable,
          enumerable,
          get(): unknown {
            return signal.value;
          },
        } as PropertyDescriptor);
      } else {
        const signal = new Atom(value);
        signalMap[key] = signal;
        Object.defineProperty(instance, key, {
          configurable,
          enumerable,
          get(): unknown {
            return signal.value;
          },
          set(value: unknown): void {
            signal.value = value;
          },
        } as PropertyDescriptor);
      }
    }
  }
}

function definePrototypeProperties<T extends object>(
  superclass: Constructable<T>,
  instance: T,
  signalMap: SignalMap,
): void {
  for (
    let prototype = superclass.prototype;
    prototype !== null && prototype !== Object.prototype;
    prototype = Object.getPrototypeOf(prototype)
  ) {
    const descriptors = Object.getOwnPropertyDescriptors(prototype);

    for (const key in descriptors) {
      const { configurable, enumerable, get, set } = descriptors[key]!;

      if (get !== undefined && configurable && !key.startsWith('_')) {
        let signal: Signal<unknown>;
        const getSignal = () => {
          if (signal === undefined) {
            const dependencies: Signal<unknown>[] = [];
            const initialResult = get.call(
              trackSignalAccesses(instance, signalMap, dependencies),
            );
            const initialVersion = dependencies.reduce(
              (version, dependency) => version + dependency.version,
              0,
            );
            signal = new Computed<unknown>(
              () => get.call(instance),
              dependencies,
              initialResult,
              initialVersion,
            );
          }
          return signal;
        };
        Object.defineProperty(signalMap, key, {
          enumerable: true,
          get: getSignal,
        });
        Object.defineProperty(instance, key, {
          configurable,
          enumerable,
          get() {
            return getSignal().value;
          },
          set,
        } as PropertyDescriptor);
      }
    }
  }
}

function isStore(value: unknown): value is StoreExtensions<unknown> {
  return typeof value === 'object' && value !== null && $signalMap in value;
}

function trackSignalAccesses<T extends object>(
  instance: T,
  signalMap: SignalMap,
  dependencies: Signal<unknown>[],
): T {
  return new Proxy(instance, {
    get: (target, key, receiver) => {
      if (key in signalMap) {
        const signal = signalMap[key]!;
        dependencies.push(signal);
        return signal.value;
      } else {
        return Reflect.get(target, key, receiver);
      }
    },
  });
}
