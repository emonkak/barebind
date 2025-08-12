import {
  Atom,
  Computed,
  Signal,
  type Subscriber,
  type Subscription,
} from './signal.js';

const NO_FLAGS = 0;
const FLAG_NEW = 0b1;
const FLAG_DIRTY = 0b10;

export interface ReactiveOptions {
  shallow?: boolean;
}

interface ReactiveContainer<T> {
  readonly source: Signal<T>;
  properties: Map<PropertyKey, ReactiveContainer<unknown>> | null;
  flags: number;
}

interface Difference {
  path: PropertyKey[];
  value: unknown;
}

type ReactiveKeys<T> = Exclude<AllKeys<T>, FunctionKeys<T>>;

type ReactiveProperty<T, K extends keyof T> = T extends object
  ? Or<IsWritable<T, K>, IsArray<T>> extends true
    ? Reactive<Get<T, K>>
    : Readonly<Reactive<Get<T, K>>>
  : undefined;

type AllKeys<T> = T extends any ? keyof T : never;

type ExplicitKeys<T> = {
  [K in AllKeys<T>]: IsPropertyKey<K> extends true ? never : K;
}[AllKeys<T>];

type FunctionKeys<T> = {
  [K in AllKeys<T>]: T[K] extends Function ? K : never;
}[AllKeys<T>];

type Get<T, K extends keyof T> = K extends ExplicitKeys<T>
  ? T[K]
  : T[K] | undefined;

type IsArray<T> = T extends readonly any[] ? true : false;

type IsPropertyKey<K> = string extends K
  ? true
  : number extends K
    ? true
    : symbol extends K
      ? true
      : false;

type IsWritable<T, K extends keyof T> = StrictEqual<
  { -readonly [P in K]-?: T[P] },
  Pick<T, K>
>;

type Or<TLhs extends boolean, TRhs extends boolean> = TLhs extends true
  ? true
  : TRhs extends true
    ? true
    : false;

type StrictEqual<TLhs, TRhs> = (<T>() => T extends TLhs ? 1 : 2) extends <
  T,
>() => T extends TRhs ? 1 : 2
  ? true
  : false;

export class Reactive<T> extends Signal<T> {
  private readonly _container: ReactiveContainer<T>;

  private readonly _options: ReactiveOptions | undefined;

  static from<T>(source: T, options?: ReactiveOptions): Reactive<T> {
    return new Reactive(toReactiveContainer(source, 0), options);
  }

  private constructor(
    container: ReactiveContainer<T>,
    options?: ReactiveOptions,
  ) {
    super();
    this._container = container;
    this._options = options;
  }

  get value(): T {
    return getSnapshot(this._container);
  }

  set value(source: T) {
    if (!(this._container.source instanceof Atom)) {
      throw new TypeError('Cannot set value on a read-only value.');
    }

    this._container.properties = null;
    this._container.flags |= FLAG_NEW;
    // We must clear the dirty flag for shallow subscription before set the new
    // source.
    this._container.flags &= ~FLAG_DIRTY;
    this._container.source.value = source;
  }

  get version(): number {
    return this._container.source.version;
  }

  diff(): Difference[] {
    const differences: Difference[] = [];
    collectDefferences(this._container, differences);
    for (let i = 0, l = differences.length; i < l; i++) {
      // The path is constructed in reverse order from child to parent.
      differences[i]!.path.reverse();
    }
    return differences;
  }

  get<K extends ReactiveKeys<T>>(
    key: K,
    options?: ReactiveOptions,
  ): ReactiveProperty<T, K>;
  get(
    key: PropertyKey,
    options?: ReactiveOptions,
  ): T extends object ? Reactive<unknown> : undefined;
  get(
    key: PropertyKey,
    options?: ReactiveOptions,
  ): Reactive<unknown> | undefined {
    if (!isObjectContainer(this._container)) {
      return undefined;
    }

    const property = getPropertyContainer(this._container, key);

    return new Reactive(property, options);
  }

  mutate<TResult>(callback: (source: T) => TResult): TResult {
    if (!(this._container.source instanceof Atom)) {
      throw new TypeError('Cannot mutate value with a readonly value.');
    }

    if (!isObjectContainer(this._container)) {
      throw new TypeError('Cannot mutate value with a non-object value.');
    }

    const proxy = proxyObject(this._container);

    return callback(proxy);
  }

  subscribe(subscriber: Subscriber): Subscription {
    const container = this._container;

    if (this._options?.shallow) {
      return container.source.subscribe(() => {
        if (!(container.flags & FLAG_DIRTY)) {
          subscriber();
        }
      });
    } else {
      return container.source.subscribe(subscriber);
    }
  }
}

function collectDefferences<T>(
  container: ReactiveContainer<T>,
  differences: Difference[],
): void {
  const { properties, flags, source } = container;

  if (flags & FLAG_NEW) {
    differences.push({ path: [], value: source.value });
  }

  if (flags & FLAG_DIRTY) {
    for (const [key, property] of properties!.entries()) {
      if (property !== null) {
        const startIndex = differences.length;
        collectDefferences(property, differences);
        for (let i = startIndex, l = differences.length; i < l; i++) {
          differences[i]!.path.push(key);
        }
      }
    }
  }
}

function getPropertyContainer<T extends object>(
  parent: ReactiveContainer<T>,
  key: PropertyKey,
): ReactiveContainer<unknown> {
  let property = parent.properties?.get(key);
  if (property !== undefined) {
    return property;
  }

  property = resolvePropertyContainer(parent, key);

  if (parent.source instanceof Atom && property.source instanceof Atom) {
    property.source.subscribe(() => {
      parent.flags |= FLAG_DIRTY;
      (parent.source as Atom<T>).touch();
    });
  }

  parent.properties ??= new Map();
  parent.properties.set(key, property);

  return property;
}

function getSnapshot<T>(container: ReactiveContainer<T>): T {
  const { properties, flags, source } = container;

  if (flags & FLAG_DIRTY) {
    const oldSource = source.value;

    if (isObject(oldSource)) {
      const newSource = shallowClone(oldSource);

      for (const [key, property] of properties!.entries()) {
        if (property !== null && property.flags & (FLAG_NEW | FLAG_DIRTY)) {
          (newSource as any)[key] = getSnapshot(property);
          property.flags &= ~FLAG_NEW;
        }
      }

      // Update the source without notification (a source of the container with
      // dirty flags is always Atom).
      (source as Atom<T>)['_value'] = newSource;
    }

    container.flags &= ~FLAG_DIRTY;
  }

  return source.value;
}

function isObject<T>(value: T): value is T & object {
  return typeof value === 'object' && value !== null;
}

function isObjectContainer<T>(
  container: ReactiveContainer<T>,
): container is ReactiveContainer<T & object> {
  return isObject(container.source.value);
}

function proxyObject<T extends object>(
  parent: ReactiveContainer<T>,
  getContainerValue: <T>(container: ReactiveContainer<T>) => T = getSnapshot,
): T {
  return new Proxy(parent.source.value, {
    get(_target, key, _receiver) {
      const property = getPropertyContainer(parent, key);
      return getContainerValue(property);
    },
    set(target, key, value, receiver) {
      const property = getPropertyContainer(parent, key);
      if (property.source instanceof Atom) {
        property.flags |= FLAG_NEW;
        property.source.value = value;
        return true;
      } else {
        return Reflect.set(target, key, value, receiver);
      }
    },
  });
}

function resolvePropertyContainer<T extends object>(
  parent: ReactiveContainer<T>,
  key: PropertyKey,
): ReactiveContainer<unknown> {
  const root = parent.source.value;
  let prototype = root;

  do {
    const propertyDescriptor = Object.getOwnPropertyDescriptor(prototype, key);

    if (propertyDescriptor !== undefined) {
      const { get, set, value } = propertyDescriptor;

      if (get !== undefined && set !== undefined) {
        return {
          source: new Atom(
            get.call(proxyObject(parent)),
            parent.source.version,
          ),
          properties: null,
          flags: NO_FLAGS,
        };
      } else if (get !== undefined) {
        const dependencies: Signal<unknown>[] = [];
        const proxy = proxyObject(parent, (container) => {
          dependencies.push(container.source);
          return getSnapshot(container);
        });
        const initialResult = get.call(proxy);
        const initialVersion = dependencies.reduce(
          (version, dependency) => version + dependency.version,
          parent.source.version,
        );
        const signal = new Computed<unknown>(
          () => get.call(proxyObject(parent)),
          dependencies,
          initialResult,
          initialVersion,
        );
        return {
          source: signal,
          properties: null,
          flags: NO_FLAGS,
        };
      } else {
        return toReactiveContainer(value, parent.source.version);
      }
    }

    prototype = Object.getPrototypeOf(prototype);
  } while (prototype !== null && prototype !== Object.prototype);

  return toReactiveContainer(undefined, parent.source.version);
}

function shallowClone<T extends object>(object: T): T {
  if (Array.isArray(object)) {
    return object.slice() as T;
  } else {
    return Object.create(
      Object.getPrototypeOf(object),
      Object.getOwnPropertyDescriptors(object),
    );
  }
}

function toReactiveContainer<T>(
  value: T,
  version: number,
): ReactiveContainer<T> {
  return {
    source: new Atom(value, version),
    properties: null,
    flags: NO_FLAGS,
  };
}
