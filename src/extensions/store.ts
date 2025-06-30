import { $customHook, type HookContext } from '../hook.js';
import {
  Atom,
  Computed,
  Lazy,
  Signal,
  type Subscriber,
  type Subscription,
} from './signal.js';

const $signalMap = Symbol('$signalMap');

export type SignalKeys<T> = Exclude<keyof T, FunctionKeys<T>> & string;

export type AtomKeys<T> = Extract<SignalKeys<T>, WritableKeys<T>>;

type Constructable<T = object> = new (...args: any[]) => T;

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

export type Store<T> = T & StoreExtensions;

export interface StoreClass<TClass extends Constructable> {
  new (...args: unknown[]): Store<InstanceType<TClass>>;
  [$customHook](context: HookContext): Store<InstanceType<TClass>>;
}

export interface StoreExtensions {
  [$customHook](context: HookContext): void;
  asSignal(): Signal<this>;
  getSignal<TKey extends SignalKeys<this>>(key: TKey): Signal<this[TKey]>;
  getSignal<TKey extends keyof this>(key: TKey): Signal<this[TKey]> | undefined;
  getSignal(key: string): Signal<unknown> | undefined;
  getVersion(): number;
  restoreSnapshot(state: Pick<this, AtomKeys<this>>): void;
  subscribe(subscriber: Subscriber): Subscription;
  toSnapshot(): Pick<this, AtomKeys<this>>;
}

export function createStoreClass<TClass extends Constructable>(
  superclass: TClass,
): StoreClass<TClass> {
  return class Store extends superclass implements StoreExtensions {
    private [$signalMap]: Record<PropertyKey, Signal<unknown>> = Object.create(
      null,
      {},
    );

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

    asSignal(): Signal<this> {
      return new StoreSignal(this);
    }

    getSignal<TKey extends SignalKeys<this>>(key: TKey): Signal<this[TKey]>;
    getSignal<TKey extends keyof this>(
      key: TKey,
    ): Signal<this[TKey]> | undefined;
    getSignal(key: string): Signal<unknown> | undefined {
      return this[$signalMap][key];
    }

    getVersion(): number {
      const signalMap = this[$signalMap];
      let version = 0;
      for (const key in signalMap) {
        const signal = signalMap[key]!;
        if (signal instanceof Atom) {
          version += signal.version;
        }
      }
      return version;
    }

    restoreSnapshot(state: Pick<this, AtomKeys<this>>): void {
      for (const key in state) {
        this[key as AtomKeys<this>] = state[key as AtomKeys<this>]!;
      }
    }

    subscribe(subscriber: Subscriber): Subscription {
      const signalMap = this[$signalMap];
      const subscriptions: Subscription[] = [];
      for (const key in signalMap) {
        const signal = signalMap[key]!;
        if (signal instanceof Atom) {
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

    toSnapshot(): Pick<this, AtomKeys<this>> {
      const signalMap = this[$signalMap];
      const state: Partial<this> = {};
      for (const key in signalMap) {
        const signal = signalMap[key]!;
        if (signal instanceof Atom) {
          state[key as AtomKeys<this>] = signal.value as this[AtomKeys<this>];
        }
      }
      return state as Pick<this, AtomKeys<this>>;
    }
  } as unknown as StoreClass<TClass>;
}

class StoreSignal<TClass extends StoreExtensions> extends Signal<TClass> {
  private readonly _store: TClass;

  constructor(store: TClass) {
    super();
    this._store = store;
  }

  get value(): TClass {
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
  signalMap: Record<PropertyKey, Signal<unknown>>,
): void {
  const descriptors = Object.getOwnPropertyDescriptors(instance);

  for (const key in descriptors) {
    const { writable, enumerable, configurable, value } = descriptors[key]!;

    if (writable && configurable) {
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

function definePrototypeProperties<T extends object>(
  superclass: Constructable<T>,
  instance: T,
  signalMap: Record<PropertyKey, Signal<unknown>>,
): void {
  for (
    let prototype = superclass.prototype;
    prototype !== null && prototype !== Object.prototype;
    prototype = Object.getPrototypeOf(prototype)
  ) {
    const descriptors = Object.getOwnPropertyDescriptors(prototype);

    for (const key in descriptors) {
      const { configurable, enumerable, get, set } = descriptors[key]!;

      if (get !== undefined && configurable) {
        const signal = new Lazy(() => {
          const dependencies: Signal<unknown>[] = [];
          const initialResult = get.call(
            trackSignals(instance, signalMap, dependencies),
          );
          const initialVersion = dependencies.reduce(
            (version, dependency) => version + dependency.version,
            0,
          );
          return new Computed<unknown>(
            () => get.call(instance),
            dependencies,
            initialResult,
            initialVersion,
          );
        });
        signalMap[key] = signal;
        Object.defineProperty(instance, key, {
          configurable,
          enumerable,
          get() {
            return signal.value;
          },
          set,
        } as PropertyDescriptor);
      }
    }
  }
}

function trackSignals<T extends object>(
  instance: T,
  signalMap: Record<PropertyKey, Signal<unknown>>,
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
