import {
  Atom,
  Computed,
  Signal,
  type Subscriber,
  type Subscription,
} from './signal.js';

const TYPE_ARRAY = 0;
const TYPE_OBJECT = 1;
const TYPE_PRIMITIVE = 2;

type ObservableDescriptor<T> =
  | {
      type: typeof TYPE_ARRAY;
      source: T & readonly unknown[];
      memoizedVersion: number;
      observableElements: Signal<unknown>[];
    }
  | {
      type: typeof TYPE_OBJECT;
      source: T & object;
      memoizedVersion: number;
      observableProperties: Map<PropertyKey, Signal<unknown>>;
    }
  | {
      type: typeof TYPE_PRIMITIVE;
      source: T;
    };

export namespace Observable {
  export type Value<T> = T extends object
    ? T extends readonly (infer Element)[]
      ? Array<Element>
      : T extends Function
        ? Primitive<T>
        : Object<T>
    : Primitive<T>;

  export interface Array<T> extends Signal<readonly T[]> {
    readonly length: number;
    value: readonly T[];
    get(index: number): Value<T> | undefined;
  }

  export interface Object<T extends object> extends Signal<T> {
    value: T;
    get<K extends ObservableKeys<T>>(key: K): ObservableProperty<T, K>;
  }

  export interface Primitive<T> extends Signal<T> {
    value: T;
  }

  type ObservableProperty<T, K extends keyof T> = IsWritable<T, K> extends true
    ? Value<T[K]>
    : Computed<T[K]>;

  type ObservableKeys<T> = Exclude<
    Extract<AllKeys<T>, string>,
    FunctionKeys<T> | PrivateKeys
  >;

  type AllKeys<T> = T extends any ? keyof T : never;

  type FunctionKeys<T> = {
    [K in AllKeys<T>]: T[K] extends Function ? K : never;
  }[AllKeys<T>];

  type PrivateKeys = `_${string}`;

  type IsWritable<T, K extends keyof T> = StrictEqual<
    { -readonly [P in K]-?: T[P] },
    Pick<T, K>
  >;

  type StrictEqual<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
    T,
  >() => T extends Y ? 1 : 2
    ? true
    : false;
}

export class Observable<T> extends Signal<T> {
  private _descriptor$: Atom<ObservableDescriptor<T>>;

  static from<T>(source: T): Observable.Value<T> {
    return new Observable(source) as any;
  }

  constructor(source: T) {
    super();
    this._descriptor$ = new Atom(toObservableDescriptor(source));
  }

  get length(): number {
    const descriptor = this._descriptor$.value;
    return descriptor.type === TYPE_ARRAY ? descriptor.source.length : 0;
  }

  get value(): T {
    const descriptor = this._descriptor$.value;

    switch (descriptor.type) {
      case TYPE_ARRAY: {
        const { observableElements, memoizedVersion } = descriptor;
        const currentVersion = this._descriptor$.version;

        if (memoizedVersion < currentVersion) {
          const source = descriptor.source.slice() as T & unknown[];

          for (let i = 0, l = source.length; i < l; i++) {
            const observableElement = observableElements[i];
            if (observableElement !== undefined) {
              source[i] = observableElement.value;
            }
          }

          descriptor.source = Object.freeze(source);
          descriptor.memoizedVersion = currentVersion;
        }
        break;
      }
      case TYPE_OBJECT: {
        const { observableProperties, memoizedVersion } = descriptor;
        const currentVersion = this._descriptor$.version;

        if (memoizedVersion < currentVersion) {
          const source = cloneObject(descriptor.source);

          for (const [key, property$] of observableProperties.entries()) {
            if (property$ instanceof Observable) {
              source[key as keyof T] = property$.value as (T & object)[keyof T];
            }
          }

          descriptor.source = Object.freeze(source);
          descriptor.memoizedVersion = currentVersion;
        }
        break;
      }
    }

    return descriptor.source;
  }

  set value(value: T) {
    this._descriptor$.value = toObservableDescriptor(value);
  }

  get version(): number {
    return this._descriptor$.version;
  }

  get(key: PropertyKey): Signal<unknown> | undefined {
    const descriptor = this._descriptor$.value;
    switch (descriptor.type) {
      case TYPE_ARRAY: {
        if (typeof key !== 'number') {
          break;
        }

        const { observableElements } = descriptor;
        let element$ = observableElements[key];

        if (element$ === undefined) {
          element$ = new Observable(descriptor.source[key]!);
          element$.subscribe(() => {
            this._descriptor$.touch();
          });
          observableElements[key] = element$;
        }

        return element$;
      }
      case TYPE_OBJECT: {
        if (typeof key !== 'string' || key.startsWith('_')) {
          break;
        }

        const { observableProperties } = descriptor;
        let property$ = observableProperties.get(key);

        if (property$ === undefined) {
          property$ = createObservableProperty(
            this as Observable<object>,
            descriptor.source,
            key,
          );

          if (property$ !== undefined) {
            if (property$ instanceof Observable) {
              property$.subscribe(() => {
                this._descriptor$.touch();
              });
            }
            observableProperties.set(key, property$);
          }
        }

        return property$;
      }
    }

    return undefined;
  }

  subscribe(subscriber: Subscriber): Subscription {
    return this._descriptor$.subscribe(subscriber);
  }
}

function cloneObject<T extends object>(object: T): T {
  return Object.assign(Object.create(Object.getPrototypeOf(object)), object);
}

function createObservableProperty<T extends object>(
  observable: Observable<T>,
  source: T,
  key: PropertyKey,
): Signal<unknown> | undefined {
  let prototype = source;

  do {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, key);

    if (descriptor !== undefined) {
      const { enumerable, get, value } = descriptor;

      if (get !== undefined) {
        const dependencies: Signal<unknown>[] = [];
        const tracker = trackObservable(observable, source, dependencies);
        const initialResult = get.call(tracker);
        const initialVersion = dependencies.reduce(
          (version, dependency) => version + dependency.version,
          0,
        );
        return new Computed<unknown>(
          () => get.call(source),
          dependencies,
          initialResult,
          initialVersion,
        );
      } else if (enumerable) {
        return new Observable(value);
      }
    }

    prototype = Object.getPrototypeOf(prototype);
  } while (prototype !== null && prototype !== Object.prototype);

  return undefined;
}

function toObservableDescriptor<T>(source: T): ObservableDescriptor<T> {
  if (typeof source === 'object' && source !== null) {
    if (Array.isArray(source)) {
      return {
        type: TYPE_ARRAY,
        source: Object.freeze(source),
        memoizedVersion: 0,
        observableElements: new Array(source.length),
      };
    } else {
      return {
        type: TYPE_OBJECT,
        source: Object.freeze(source),
        memoizedVersion: 0,
        observableProperties: new Map(),
      };
    }
  } else {
    return {
      type: TYPE_PRIMITIVE,
      source,
    };
  }
}

function trackObservable<T extends object>(
  observale: Observable<T>,
  source: T,
  dependencies: Signal<unknown>[],
): T {
  return new Proxy(source, {
    get: (target, key, receiver) => {
      const property$ = observale.get(key);
      if (property$ !== undefined) {
        dependencies.push(property$);
        return property$.value;
      } else {
        return Reflect.get(target, key, receiver);
      }
    },
  });
}
