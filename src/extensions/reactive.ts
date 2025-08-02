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

export interface ReactiveOptions {
  shallow?: boolean;
}

interface ReactiveDescriptor<T> {
  readonly source$: Signal<T>;
  flags: number;
  children: Map<PropertyKey, ReactiveDescriptor<unknown> | null> | null;
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
  private readonly _descriptor: ReactiveDescriptor<T>;

  private readonly _options: ReactiveOptions | undefined;

  static from<T>(source: T, options?: ReactiveOptions): Reactive<T> {
    return new Reactive(toReactiveDescriptor(source, 0), options);
  }

  private constructor(
    descriptor: ReactiveDescriptor<T>,
    options?: ReactiveOptions,
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

    // We must clear the dirty flag for shallow subscription before set the new
    // source.
    descriptor.flags |= FLAG_NEW;
    descriptor.flags &= ~FLAG_DIRTY;
    descriptor.children = null;
    descriptor.source$.value = source;
  }

  get version(): number {
    return this._descriptor.source$.version;
  }

  diff(): Difference[] {
    const differences: Difference[] = [];
    collectDefferences(this._descriptor, differences);
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
  ): Reactive<unknown> | undefined;
  get(
    key: PropertyKey,
    options?: ReactiveOptions,
  ): Reactive<unknown> | undefined {
    const child = getChildDescriptor(this._descriptor, key);
    return child !== null ? new Reactive(child, options) : undefined;
  }

  mutate<TResult>(callback: (source: T) => TResult): TResult {
    if (!(this._descriptor.source$ instanceof Atom)) {
      throw new TypeError('Cannot mutate value with a readonly descriptor.');
    }

    if (!isObject(this._descriptor.source$.value)) {
      throw new TypeError('Cannot mutate value with a non-object descriptor.');
    }

    const proxy = proxyObjectDescriptor(
      this._descriptor as ReactiveDescriptor<T & object>,
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

function collectDefferences<T>(
  descriptor: ReactiveDescriptor<T>,
  differences: Difference[],
): void {
  const { children, flags, source$ } = descriptor;

  if (flags & FLAG_NEW) {
    differences.push({ path: [], value: source$.value });
  }

  if (flags & FLAG_DIRTY) {
    for (const [key, child] of children!.entries()) {
      if (child !== null) {
        const startIndex = differences.length;
        collectDefferences(child, differences);
        for (let i = startIndex, l = differences.length; i < l; i++) {
          differences[i]!.path.push(key);
        }
      }
    }
  }
}

function getChildDescriptor<T>(
  parent: ReactiveDescriptor<T>,
  key: PropertyKey,
): ReactiveDescriptor<unknown> | null {
  let child = parent.children?.get(key);
  if (child !== undefined) {
    return child;
  }

  if (isObject(parent.source$.value)) {
    child = resolveChildDescriptor(
      parent as ReactiveDescriptor<T & object>,
      key,
    );

    if (parent.source$ instanceof Atom && child.source$ instanceof Atom) {
      child.source$.subscribe(() => {
        parent.flags |= FLAG_DIRTY;
        (parent.source$ as Atom<T>).touch();
      });
    }
  } else {
    child = null;
  }

  parent.children ??= new Map();
  parent.children.set(key, child);

  return child;
}

function getSnapshot<T>(descriptor: ReactiveDescriptor<T>): T {
  const { children, flags, source$ } = descriptor;

  if (flags & FLAG_DIRTY) {
    const oldSource = source$.value;

    if (isObject(oldSource)) {
      const newSource = shallowClone(oldSource);

      for (const [key, child] of children!.entries()) {
        if (child !== null && child.flags & (FLAG_NEW | FLAG_DIRTY)) {
          (newSource as any)[key] = getSnapshot(child);
          child.flags &= ~FLAG_NEW;
        }
      }

      // Update the source without notification to subscribers.
      (source$ as Atom<T>)['_value'] = newSource;
    }

    descriptor.flags &= ~FLAG_DIRTY;
  }

  return source$.value;
}

function isObject<T>(value: T): value is T & object {
  return typeof value === 'object' && value !== null;
}

function proxyObjectDescriptor<T extends object>(
  descriptor: ReactiveDescriptor<T>,
  getChildValue: <T>(descriptor: ReactiveDescriptor<T>) => T = getSnapshot,
): T {
  return new Proxy(descriptor.source$.value, {
    get(target, key, receiver) {
      const child = getChildDescriptor(descriptor, key);
      if (child !== null) {
        return getChildValue(child);
      } else {
        return Reflect.get(target, key, receiver);
      }
    },
    set(target, key, value, receiver) {
      const child = getChildDescriptor(descriptor, key);
      if (child !== null && child.source$ instanceof Atom) {
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
  parent: ReactiveDescriptor<T>,
  key: PropertyKey,
): ReactiveDescriptor<unknown> {
  const root = parent.source$.value;
  let prototype = root;

  do {
    const propertyDescriptor = Object.getOwnPropertyDescriptor(prototype, key);

    if (propertyDescriptor !== undefined) {
      const { get, set, value } = propertyDescriptor;

      if (get !== undefined && set !== undefined) {
        return {
          source$: new Atom(
            get.call(proxyObjectDescriptor(parent)),
            parent.source$.version,
          ),
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
          parent.source$.version,
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
      } else {
        return toReactiveDescriptor(value, parent.source$.version);
      }
    }

    prototype = Object.getPrototypeOf(prototype);
  } while (prototype !== null && prototype !== Object.prototype);

  return toReactiveDescriptor(undefined, parent.source$.version);
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

function toReactiveDescriptor<T>(
  value: T,
  version: number,
): ReactiveDescriptor<T> {
  return {
    source$: new Atom(value, version),
    flags: NO_FLAGS,
    children: null,
  };
}
