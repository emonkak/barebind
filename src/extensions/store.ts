import type { CustomHook, HookContext } from '../hook.js';
import {
  Atom,
  Computed,
  Lazy,
  Signal,
  type Subscriber,
  type Subscription,
} from './signal.js';

const $signalMap = Symbol('$signalMap');

export interface StoreClass<TClass extends Constructable>
  extends CustomHook<UseStore<InstanceType<TClass>>> {
  new (...args: unknown[]): UseStore<InstanceType<TClass>>;
}

export interface StoreExtensions extends CustomHook<void> {
  asSignal(): Signal<this>;
  getSignal<TKey extends SignalKeys<this>>(key: TKey): Signal<this[TKey]>;
  getSignal(key: PropertyKey): Signal<unknown> | undefined;
  getVersion(): number;
  subscribe(subscriber: Subscriber): Subscription;
}

type UseStore<T> = T & StoreExtensions;

type Constructable<T = object> = new (...args: any[]) => T;

type SignalKeys<T> = Exclude<keyof T & string, PrivateKeys | FunctionKeys<T>>;

type PrivateKeys = `_${string}`;

type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

export function defineStore<TClass extends Constructable>(
  superclass: TClass,
): StoreClass<TClass> {
  return class Store extends superclass implements StoreExtensions {
    private [$signalMap]: Record<PropertyKey, Signal<unknown>> = Object.create(
      null,
      {},
    );

    static onCustomHook(
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

    onCustomHook(context: HookContext): void {
      context.setContextValue(this.constructor, this);
    }

    asSignal(): Signal<this> {
      return new StoreSignal(this);
    }

    getSignal<TKey extends SignalKeys<this>>(key: TKey): Signal<this[TKey]>;
    getSignal(key: string): Signal<unknown> | undefined {
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

    if (writable && configurable && !key.startsWith('_')) {
      if (isStore(value)) {
        const signal = new StoreSignal(Object.freeze(value));
        signalMap[key] = signal;
        Object.defineProperty(instance, key, {
          configurable,
          enumerable,
          get(): unknown {
            return signal.value;
          },
        } as PropertyDescriptor);
      } else {
        const signal = new Atom(Object.freeze(value));
        signalMap[key] = signal;
        Object.defineProperty(instance, key, {
          configurable,
          enumerable,
          get(): unknown {
            return signal.value;
          },
          set(value: unknown): void {
            signal.value = Object.freeze(value);
          },
        } as PropertyDescriptor);
      }
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

      if (get !== undefined && configurable && !key.startsWith('_')) {
        const signal = new Lazy(() => {
          const dependencies: Signal<unknown>[] = [];
          const initialResult = get.call(
            trackSignalAccesses(instance, signalMap, dependencies),
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

function isStore(value: unknown): value is StoreExtensions {
  return typeof value === 'object' && value !== null && $signalMap in value;
}

function trackSignalAccesses<T extends object>(
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
