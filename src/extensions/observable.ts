import {
  Atom,
  Computed,
  Signal,
  type Subscriber,
  type Subscription,
} from './signal.js';

const NO_FLAGS = 0b0;
const FLAG_NEW = 0b01;
const FLAG_DIRTY = 0b10;

export interface ObservableOptions {
  shallow?: boolean;
}

interface ObservableDescriptor<T> {
  readonly source$: Signal<T>;
  flags: number;
  children: Map<PropertyKey, ObservableDescriptor<unknown> | undefined> | null;
}

type ObservableProperty<T, K extends ObservableKeys<T>> = T extends object
  ? Or<IsWritable<T, K>, IsNumber<K>> extends true
    ? Observable<T[K]>
    : Readonly<Observable<T[K]>>
  : undefined;

type ObservableKeys<T> = Exclude<AllKeys<T>, FunctionKeys<T>>;

type FunctionKeys<T> = {
  [K in AllKeys<T>]: T[K] extends Function ? K : never;
}[AllKeys<T>];

type AllKeys<T> = T extends any ? keyof T : never;

type IsWritable<T, K extends keyof T> = StrictEqual<
  { -readonly [P in K]-?: T[P] },
  Pick<T, K>
>;

type IsNumber<T> = T extends number ? true : false;

type StrictEqual<TLhs, TRhs> = (<T>() => T extends TLhs ? 1 : 2) extends <
  T,
>() => T extends TRhs ? 1 : 2
  ? true
  : false;

type Or<TLhs extends boolean, TRhs extends boolean> = TLhs extends true
  ? true
  : TRhs extends true
    ? true
    : false;

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

  set value(source: T) {
    const descriptor = this._descriptor;
    if (!(descriptor.source$ instanceof Atom)) {
      throw new TypeError('Cannot set value on a read-only descriptor.');
    }

    // We must clear the dirty flag for shallow subscription before assign the
    // value.
    descriptor.flags |= FLAG_NEW;
    descriptor.flags &= ~FLAG_DIRTY;
    descriptor.children = null;
    descriptor.source$.value = source;
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
  ): Observable<unknown> | undefined;
  get(
    key: PropertyKey,
    options?: ObservableOptions,
  ): Observable<unknown> | undefined {
    const child = getChildDescriptor(this._descriptor, key);
    return child !== undefined ? new Observable(child, options) : undefined;
  }

  mutate<TResult>(callback: (source: T) => TResult): TResult {
    if (!(this._descriptor.source$ instanceof Atom)) {
      throw new TypeError('Cannot mutate value with a readonly descriptor.');
    }

    if (!isObject(this._descriptor.source$.value)) {
      throw new TypeError('Cannot mutate value with a non-object descriptor.');
    }

    const proxy = proxyObjectDescriptor(
      this._descriptor as ObservableDescriptor<T & object>,
    );

    return callback(proxy);
  }

  subscribe(subscriber: Subscriber): Subscription {
    const descriptor = this._descriptor;

    if (this._options?.shallow) {
      return descriptor.source$.subscribe(() => {
        if (!(descriptor.flags & FLAG_DIRTY)) {
          subscriber();
        }
      });
    } else {
      return descriptor.source$.subscribe(subscriber);
    }
  }
}

function cloneObject<T extends object>(object: T): T {
  return Object.create(
    Object.getPrototypeOf(object),
    Object.getOwnPropertyDescriptors(object),
  );
}

function getChildDescriptor<T>(
  parent: ObservableDescriptor<T>,
  key: PropertyKey,
): ObservableDescriptor<unknown> | undefined {
  let child = parent.children?.get(key);
  if (child !== undefined) {
    return child;
  }

  if (isObject(parent.source$.value)) {
    child = resolveChildDescriptor(
      parent as ObservableDescriptor<T & object>,
      key,
    );

    if (child !== undefined && child.source$ instanceof Atom) {
      child.source$.subscribe(() => {
        parent.flags |= FLAG_DIRTY;

        if (parent.source$ instanceof Atom) {
          parent.source$.touch();
        }
      });
    }
  }

  parent.children ??= new Map();
  parent.children.set(key, child);

  return child;
}

function getSnapshot<T>(descriptor: ObservableDescriptor<T>): T {
  const { children, flags, source$ } = descriptor;

  if (flags & FLAG_DIRTY && source$ instanceof Atom) {
    const oldSource = source$.value;

    if (isObject(oldSource)) {
      const newSource = Array.isArray(oldSource)
        ? oldSource.slice()
        : cloneObject(oldSource);

      for (const [key, child] of children!.entries()) {
        if (child !== undefined && child.flags & (FLAG_NEW | FLAG_DIRTY)) {
          newSource[key] = getSnapshot(child);
          child.flags &= ~FLAG_NEW;
        }
      }

      // Update the source without notification to subscribers.
      source$['_value'] = newSource;
    }

    descriptor.flags &= ~FLAG_DIRTY;
  }

  return source$.value;
}

function isObject<T>(value: T): value is T & object {
  return typeof value === 'object' && value !== null;
}

function proxyObjectDescriptor<T extends object>(
  descriptor: ObservableDescriptor<T>,
  getChildValue: <T>(descriptor: ObservableDescriptor<T>) => T = getSnapshot,
): T {
  return new Proxy(descriptor.source$.value, {
    get(target, key, receiver) {
      const child = getChildDescriptor(descriptor, key);
      if (child !== undefined) {
        return getChildValue(child);
      } else {
        return Reflect.get(target, key, receiver);
      }
    },
    set(target, key, value, receiver) {
      const child = getChildDescriptor(descriptor, key);
      if (child !== undefined && child.source$ instanceof Atom) {
        child.flags |= FLAG_NEW;
        child.source$.value = value;
        return true;
      } else {
        return Reflect.set(target, key, value, receiver);
      }
    },
  });
}

function resolveChildDescriptor<T extends object>(
  parent: ObservableDescriptor<T>,
  key: PropertyKey,
): ObservableDescriptor<unknown> | undefined {
  const root = parent.source$.value;
  let prototype = root;

  do {
    const propertyDescriptor = Object.getOwnPropertyDescriptor(prototype, key);

    if (propertyDescriptor !== undefined) {
      const { get, set, value } = propertyDescriptor;

      if (get !== undefined && set !== undefined) {
        return {
          source$: new Atom(get.call(proxyObjectDescriptor(parent))),
          flags: NO_FLAGS,
          children: null,
        };
      } else if (get !== undefined) {
        const dependencies: Signal<unknown>[] = [];
        const proxy = proxyObjectDescriptor(parent, (child) => {
          dependencies.push(child.source$);
          return getSnapshot(child);
        });
        const initialResult = get.call(proxy);
        const initialVersion = dependencies.reduce(
          (version, dependency) => version + dependency.version,
          0,
        );
        const signal = new Computed<unknown>(
          () => get.call(proxyObjectDescriptor(parent)),
          dependencies,
          initialResult,
          initialVersion,
        );
        return {
          source$: signal,
          flags: NO_FLAGS,
          children: null,
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
    source$: new Atom(source),
    flags: NO_FLAGS,
    children: null,
  };
}
