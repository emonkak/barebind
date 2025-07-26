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
  children: Map<PropertyKey, ObservableDescriptor<unknown> | undefined> | null;
}

type ObservableKeys<T> = Exclude<AllKeys<T>, FunctionKeys<T>>;

type ObservableProperty<T, K extends keyof T> = T extends object
  ? Observable<T[K]>
  : undefined;

type AllKeys<T> = T extends any ? keyof T : never;

type FunctionKeys<T> = {
  [K in AllKeys<T>]: T[K] extends Function ? K : never;
}[AllKeys<T>];

export class Observable<T> extends Signal<T> {
  private readonly _descriptor: ObservableDescriptor<T>;

  private readonly _options: ObservableOptions | undefined;

  static from<T>(source: T, options?: ObservableOptions): Observable<T> {
    return new Observable(createObservableDescriptor(source), options);
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
    descriptor.children = null;
    descriptor.source$.value = value;
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
    const child = getChildDescriptor(this._descriptor, key);
    return child !== undefined ? new Observable(child, options) : undefined;
  }

  mutate(callback: (source: T) => void): void {
    const source = this._descriptor.source$.value;
    if (!isObject(source)) {
      throw new TypeError('Cannot mutate value with a non-object descriptor.');
    }

    const proxy = proxyDescriptor(
      this._descriptor as ObservableDescriptor<T & object>,
    );

    callback(proxy);
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
  return Object.create(
    Object.getPrototypeOf(object),
    Object.getOwnPropertyDescriptors(object),
  );
}

function createObservableDescriptor<T>(source: T): ObservableDescriptor<T> {
  return {
    source$: new Atom(source),
    children: null,
    dirty: false,
  };
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

    if (child?.source$ instanceof Atom) {
      child.source$.subscribe(() => {
        parent.dirty = true;

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
  const { dirty, children, source$ } = descriptor;

  if (dirty && source$ instanceof Atom) {
    const oldSource = source$.value;

    if (isObject(oldSource)) {
      const newSource = Array.isArray(oldSource)
        ? oldSource.slice()
        : cloneObject(oldSource);

      for (const [key, child] of children!.entries()) {
        if (child?.source$ instanceof Atom) {
          newSource[key] = getSnapshot(child);
        }
      }

      source$['_value'] = newSource;
    }

    descriptor.dirty = false;
  }

  return source$.value;
}

function isObject<T>(value: T): value is T & object {
  return typeof value === 'object' && value !== null;
}

function proxyDescriptor<T extends object>(
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
      if (child?.source$ instanceof Atom) {
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
      const { get, value } = propertyDescriptor;

      if (get !== undefined) {
        const dependencies: Signal<unknown>[] = [];
        const proxy = proxyDescriptor(parent, (child) => {
          dependencies.push(child.source$);
          return getSnapshot(child);
        });
        const initialResult = get.call(proxy);
        const initialVersion = dependencies.reduce(
          (version, dependency) => version + dependency.version,
          0,
        );
        const signal = new Computed<unknown>(
          () => get.call(proxyDescriptor(parent)),
          dependencies,
          initialResult,
          initialVersion,
        );
        return {
          source$: signal,
          children: null,
          dirty: false,
        };
      } else if (prototype === root) {
        return createObservableDescriptor(value);
      }
    }

    prototype = Object.getPrototypeOf(prototype);
  } while (prototype !== null && prototype !== Object.prototype);

  return undefined;
}
