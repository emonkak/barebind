import {
  Atom,
  Computed,
  Signal,
  type Subscriber,
  type Subscription,
} from './signal.js';

type Observable<T> = T extends object
  ? T extends readonly (infer Element)[]
    ? ObservableArray<Element>
    : ObservableObject<T>
  : Atom<T>;

type ObservableProperty<T, K extends keyof T> = IsWritable<T, K> extends true
  ? Observable<T[K]>
  : Computed<T[K]>;

type ObservableKeys<T> = Exclude<
  Extract<keyof T, string>,
  PrivateKeys | FunctionKeys<T>
>;

type PrivateKeys = `_${string}`;

type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

type IsWritable<T, K extends keyof T> = StrictEqual<
  { -readonly [P in K]-?: T[P] },
  Pick<T, K>
>;

type StrictEqual<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
  T,
>() => T extends Y ? 1 : 2
  ? true
  : false;

export class ObservableArray<T> extends Signal<readonly T[]> {
  private readonly _observableElements: Atom<(Signal<T> | undefined)[]>;

  private _memoizedSource: readonly T[];

  private _memoizedVersion: number;

  constructor(source: readonly T[]) {
    super();

    this._observableElements = new Atom(new Array(source.length));
    this._memoizedSource = source;
    this._memoizedVersion = 0;
  }

  get value(): readonly T[] {
    const currentVersion = this.version;

    if (this._memoizedVersion < currentVersion) {
      const observableElements = this._observableElements.value;
      const source = this._memoizedSource.slice();

      for (let i = 0, l = source.length; i < l; i++) {
        const observableElement = observableElements[i];
        if (observableElement !== undefined) {
          source[i] = observableElement.value as T;
        }
      }

      this._memoizedSource = source;
      this._memoizedVersion = currentVersion;
    }

    return this._memoizedSource;
  }

  set value(source: readonly T[]) {
    this._observableElements.value = new Array(source.length);
    this._memoizedSource = source;
    this._memoizedVersion = 0;
  }

  get version(): number {
    const observableElements = this._observableElements.value;
    let version = 0;

    for (let i = 0, l = observableElements.length; i < l; i++) {
      version += observableElements[i]?.version ?? 0;
    }

    return version;
  }

  get length(): number {
    return this._memoizedSource.length;
  }

  get(index: number): Observable<T> | undefined {
    const observableElements = this._observableElements.value;
    let element$ = observableElements[index];

    if (element$ === undefined) {
      element$ = toObservable(this._memoizedSource[index]!);

      element$.subscribe(() => {
        this._observableElements.notifySubscribers();
      });

      observableElements[index] = element$;
    }

    return element$ as Observable<T> | undefined;
  }

  set(index: number, value: T): void {
    const observableElements = this._observableElements.value;
    const element$ = toObservable(value);

    observableElements[index] = element$;

    this._memoizedVersion = -1;
  }

  subscribe(subscriber: Subscriber): Subscription {
    return this._observableElements.subscribe(subscriber);
  }
}

export class ObservableObject<T extends object> extends Signal<T> {
  private readonly _observableProperties: Atom<
    Map<PropertyKey, Signal<unknown>>
  > = new Atom(new Map());

  private _memoizedSource: T;

  private _memoizedVersion: number;

  constructor(source: T) {
    super();

    this._memoizedSource = source;
    this._memoizedVersion = 0;
  }

  get value(): T {
    const currentVersion = this.version;

    if (this._memoizedVersion < currentVersion) {
      const observableProperties = this._observableProperties.value;
      const source = cloneObject(this._memoizedSource);

      for (const [key, observableProperty] of observableProperties.entries()) {
        source[key as keyof T] = observableProperty.value as T[keyof T];
      }

      this._memoizedSource = source;
      this._memoizedVersion = currentVersion;
    }

    return this._memoizedSource;
  }

  set value(source: T) {
    this._observableProperties.value = new Map();
    this._memoizedSource = source;
    this._memoizedVersion = 0;
  }

  get version(): number {
    let version = 0;

    for (const observableProperty of this._observableProperties.value.values()) {
      version += observableProperty.version;
    }

    return version;
  }

  get<TKey extends ObservableKeys<T>>(key: TKey): ObservableProperty<T, TKey>;
  get(key: PropertyKey): Signal<unknown> | undefined;
  get(key: PropertyKey): Signal<unknown> | undefined {
    const observableProperties = this._observableProperties.value;
    let property$ = observableProperties.get(key);

    if (
      property$ === undefined &&
      typeof key === 'string' &&
      !key.startsWith('_')
    ) {
      property$ = toObservableProperty(this, this._memoizedSource, key);

      if (isObservable(property$)) {
        property$.subscribe(() => {
          this._observableProperties.notifySubscribers();
        });

        observableProperties.set(key, property$);
      }
    }

    return property$;
  }

  set<TKey extends ObservableKeys<T>>(key: TKey, value: T[TKey]): void {
    const observableProperties = this._observableProperties.value;
    const property$ = toObservable(value);

    observableProperties.set(key, property$);

    this._memoizedVersion = -1;
  }

  subscribe(subscriber: Subscriber): Subscription {
    return this._observableProperties.subscribe(subscriber);
  }
}

function cloneObject<T extends object>(object: T): T {
  return Object.assign(Object.create(Object.getPrototypeOf(object)), object);
}

function isObservable<T>(value: T): value is T & Observable<T> {
  return (
    value instanceof Atom ||
    value instanceof ObservableArray ||
    value instanceof ObservableObject
  );
}

function toObservable<T>(value: T): Signal<T> {
  if (typeof value === 'object' && value !== null) {
    return Array.isArray(value)
      ? (new ObservableArray(value) as any)
      : new ObservableObject(value);
  } else {
    return new Atom(value);
  }
}

function toObservableProperty<T extends object>(
  observable: ObservableObject<T>,
  source: T,
  key: PropertyKey,
): Signal<unknown> | undefined {
  do {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);

    if (descriptor !== undefined) {
      const { enumerable, writable, get, value } = descriptor;

      if (enumerable && writable) {
        return toObservable(value);
      } else if (get !== undefined) {
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
      }
    }

    source = Object.getPrototypeOf(source);
  } while (source !== null && source !== Object.prototype);

  return undefined;
}

function trackObservable<T extends object>(
  observale: ObservableObject<T>,
  source: T,
  dependencies: Signal<unknown>[],
): T {
  return new Proxy(source, {
    get: (target, key, receiver) => {
      const observaleProperty = observale.get(key);
      if (observaleProperty !== undefined) {
        dependencies.push(observaleProperty);
        return observaleProperty.value;
      } else {
        return Reflect.get(target, key, receiver);
      }
    },
  });
}

class Counter {
  count: number;

  constructor(initialCount: number = 0) {
    this.count = initialCount;
  }

  get doublyCount(): number {
    return this.count * 2;
  }
}

const source = new Counter(100);
const counter = new ObservableObject(source);

counter.subscribe(() => {
  console.log('counter changed');
});

// console.log(counter.get('count').value);
console.log(counter.get('doublyCount').value);

counter.get('count').value++;

console.log(counter.value);
