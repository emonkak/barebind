import {
  Atom,
  Computed,
  Signal,
  type Subscriber,
  type Subscription,
} from './signal.js';

export interface ObservableOptions {
  shallow?: boolean;
}

interface ObservableDescriptor<T> {
  readonly source$: Signal<T>;
  dirty: boolean;
  childDescriptors: Map<
    PropertyKey,
    ObservableDescriptor<unknown> | undefined
  > | null;
}

type ObservableKeys<T> = Exclude<
  Extract<AllKeys<T>, string | number>,
  FunctionKeys<T> | PrivateKeys
>;

type ObservableProperty<T, K extends keyof T> = T extends object
  ? Observable<T[K]>
  : undefined;

type AllKeys<T> = T extends any ? keyof T : never;

type FunctionKeys<T> = {
  [K in AllKeys<T>]: T[K] extends Function ? K : never;
}[AllKeys<T>];

type PrivateKeys = `_${string}`;

export class Observable<T> extends Signal<T> {
  private readonly _descriptor: ObservableDescriptor<T>;

  private readonly _options: ObservableOptions | undefined;

  static from<T>(source: T, options?: ObservableOptions): Observable<T> {
    return new Observable(toObservableDescriptor(source), options);
  }

  private constructor(
    descriptor: ObservableDescriptor<T>,
    options?: ObservableOptions,
  ) {
    super();
    this._descriptor = descriptor;
    this._options = options;
  }

  get length(): number {
    const source = this._descriptor.source$.value;
    return Array.isArray(source) ? source.length : 0;
  }

  get value(): T {
    return getSnapshot(this._descriptor);
  }

  set value(value: T) {
    const descriptor = this._descriptor;

    if (!(descriptor.source$ instanceof Atom)) {
      throw new TypeError('Cannot set value on a read-only descriptor.');
    }

    descriptor.dirty = false;
    descriptor.childDescriptors = null;
    descriptor.source$.value = Object.freeze(value);
  }

  get version(): number {
    return this._descriptor.source$.version;
  }

  get<K extends ObservableKeys<T>>(
    key: K,
    options?: ObservableOptions,
  ): ObservableProperty<T, K>;
  get(
    key: PropertyKey,
    options?: ObservableOptions,
  ): Observable<unknown> | undefined {
    const childDescriptor = getChildDescriptor(this._descriptor, key);
    if (childDescriptor !== undefined) {
      return new Observable(childDescriptor, options);
    } else {
      return undefined;
    }
  }

  subscribe(subscriber: Subscriber): Subscription {
    const descriptor = this._descriptor;

    if (this._options?.shallow) {
      return descriptor.source$.subscribe(() => {
        if (!descriptor.dirty) {
          subscriber();
        }
      });
    } else {
      return descriptor.source$.subscribe(subscriber);
    }
  }
}

function cloneObject<T extends object>(object: T): T {
  return Object.assign(Object.create(Object.getPrototypeOf(object)), object);
}

function getChildDescriptor<T>(
  parentDescriptor: ObservableDescriptor<T>,
  key: PropertyKey,
): ObservableDescriptor<unknown> | undefined {
  const { source$ } = parentDescriptor;
  const source = source$.value;

  let childDescriptor = parentDescriptor.childDescriptors?.get(key);

  if (
    childDescriptor === undefined &&
    typeof source === 'object' &&
    source !== null
  ) {
    childDescriptor = toChildDescriptor(
      parentDescriptor as ObservableDescriptor<object>,
      key,
    );

    if (childDescriptor?.source$ instanceof Atom) {
      childDescriptor.source$.subscribe(() => {
        parentDescriptor.dirty = true;

        if (parentDescriptor.source$ instanceof Atom) {
          parentDescriptor.source$.touch();
        }
      });
    }
  }

  parentDescriptor.childDescriptors ??= new Map();
  parentDescriptor.childDescriptors.set(key, childDescriptor);

  return childDescriptor;
}

function getSnapshot<T>(descriptor: ObservableDescriptor<T>): T {
  const { dirty, childDescriptors, source$ } = descriptor;

  if (dirty && source$ instanceof Atom) {
    const oldSource = source$.value;

    if (typeof oldSource === 'object' && oldSource !== null) {
      const newSource = Array.isArray(oldSource)
        ? oldSource.slice()
        : cloneObject(oldSource);

      for (const [key, childDescriptor] of childDescriptors!.entries()) {
        if (childDescriptor?.source$ instanceof Atom) {
          newSource[key] = getSnapshot(childDescriptor);
        }
      }

      source$['_value'] = newSource;
    }

    descriptor.dirty = false;
  }

  return source$.value;
}

function proxyDescriptor<T extends object>(
  descriptor: ObservableDescriptor<T>,
): T {
  return new Proxy(Object.create(descriptor.source$.value), {
    get: (target, key, receiver) => {
      const childDescriptor = getChildDescriptor(descriptor, key);
      if (childDescriptor !== undefined) {
        return getSnapshot(childDescriptor);
      } else {
        return Reflect.get(target, key, receiver);
      }
    },
  });
}

function toChildDescriptor<T extends object>(
  parentDescriptor: ObservableDescriptor<T>,
  key: PropertyKey,
): ObservableDescriptor<unknown> | undefined {
  const root = parentDescriptor.source$.value;
  let prototype = root;

  do {
    const propertyDescriptor = Object.getOwnPropertyDescriptor(prototype, key);

    if (propertyDescriptor !== undefined) {
      const { get, value } = propertyDescriptor;

      if (get !== undefined) {
        const dependencies: Signal<unknown>[] = [];
        const proxy = trackDescriptor(parentDescriptor, dependencies);
        const initialResult = get.call(proxy);
        const initialVersion = dependencies.reduce(
          (version, dependency) => version + dependency.version,
          0,
        );
        const signal = new Computed<unknown>(
          () => get.call(proxyDescriptor(parentDescriptor)),
          dependencies,
          initialResult,
          initialVersion,
        );
        return {
          source$: signal,
          childDescriptors: null,
          dirty: false,
        };
      } else if (prototype === root) {
        return toObservableDescriptor(value);
      }
    }

    prototype = Object.getPrototypeOf(prototype);
  } while (prototype !== null && prototype !== Object.prototype);

  return undefined;
}

function toObservableDescriptor<T>(source: T): ObservableDescriptor<T> {
  return {
    source$: new Atom(Object.freeze(source)),
    childDescriptors: null,
    dirty: false,
  };
}

function trackDescriptor<T extends object>(
  descriptor: ObservableDescriptor<T>,
  dependencies: Signal<unknown>[],
): T {
  return new Proxy(descriptor.source$.value, {
    get: (target, key, receiver) => {
      const childDescriptor = getChildDescriptor(descriptor, key);
      if (childDescriptor !== undefined) {
        dependencies.push(childDescriptor.source$);
        return getSnapshot(childDescriptor);
      } else {
        return Reflect.get(target, key, receiver);
      }
    },
  });
}
