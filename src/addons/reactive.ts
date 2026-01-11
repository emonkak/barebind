import {
  Atom,
  Computed,
  Signal,
  type Subscriber,
  type Subscription,
} from './signal.js';

const NO_FLAGS = 0;
const FLAG_NEEDS_SNAPSHOT = 0b01;
const FLAG_PENGING_VALUE = 0b10;
const FLAG_DIRTY = 0b11;

export interface ReactiveOptions {
  shallow?: boolean;
}

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

interface ReactiveState<T> {
  readonly signal: Signal<T>;
  children: Map<PropertyKey, ReactiveState<unknown>> | null;
  flags: number;
}

type ReactiveKeys<T> = Exclude<AllKeys<T>, FunctionKeys<T>>;

type ReactiveProperty<T, K extends keyof T> = T extends object
  ? Or<IsWritable<T, K>, IsArray<T>> extends true
    ? Reactive<Get<T, K>>
    : Readonly<Reactive<Get<T, K>>>
  : null;

type StrictEqual<TLhs, TRhs> =
  (<T>() => T extends TLhs ? 1 : 2) extends <T>() => T extends TRhs ? 1 : 2
    ? true
    : false;

export class Reactive<T> extends Signal<T> {
  private readonly _state: ReactiveState<T>;

  private readonly _shallow: boolean;

  static from<T>(value: T, options?: ReactiveOptions): Reactive<T> {
    return new Reactive(createState(new Atom(value)), options);
  }

  private constructor(state: ReactiveState<T>, options: ReactiveOptions = {}) {
    super();
    this._state = state;
    this._shallow = options.shallow ?? false;
  }

  get value(): T {
    return takeSnapshot(this._state);
  }

  set value(value: T) {
    if (!(this._state.signal instanceof Atom)) {
      throw new TypeError('Cannot set value on a read-only value.');
    }

    this._state.children = null;
    this._state.flags |= FLAG_PENGING_VALUE;
    this._state.flags &= ~FLAG_NEEDS_SNAPSHOT;
    this._state.signal.value = value;
  }

  get version(): number {
    return this._state.signal.version;
  }

  get<K extends ReactiveKeys<T>>(
    key: K,
    options?: ReactiveOptions,
  ): ReactiveProperty<T, K>;
  get(
    key: PropertyKey,
    options?: ReactiveOptions,
  ): T extends object ? Reactive<unknown> : null;
  get(key: PropertyKey, options?: ReactiveOptions): Reactive<unknown> | null {
    if (!isObject(this._state.signal.value)) {
      return null;
    }

    const childState = getChildState(this._state, key);
    return new Reactive(childState, options);
  }

  mutate<TResult>(callback: (value: T) => TResult): TResult {
    if (!(this._state.signal instanceof Atom)) {
      throw new TypeError('Cannot mutate value with a readonly value.');
    }

    if (!isObject(this._state.signal.value)) {
      throw new TypeError('Cannot mutate value with a non-object value.');
    }

    const proxy = proxyObject(this._state);
    return callback(proxy);
  }

  subscribe(subscriber: Subscriber): Subscription {
    const state = this._state;

    if (this._shallow) {
      return state.signal.subscribe((event) => {
        if (event.source === state.signal) {
          subscriber(event);
        }
      });
    } else {
      return state.signal.subscribe(subscriber);
    }
  }
}

function createState<T>(signal: Signal<T>): ReactiveState<T> {
  return {
    signal,
    children: null,
    flags: NO_FLAGS,
  };
}

function getChildState<T>(
  state: ReactiveState<T>,
  key: PropertyKey,
): ReactiveState<unknown> {
  let childState = state.children?.get(key);
  if (childState !== undefined) {
    return childState;
  }

  childState = resolveChildState(state, key);

  if (state.signal instanceof Atom && childState.signal instanceof Atom) {
    childState.signal.subscribe((event) => {
      state.flags |= FLAG_DIRTY;
      (state.signal as Atom<T>).invalidate({
        ...event,
        reversePath: event.reversePath.concat(key),
      });
    });
  }

  state.children ??= new Map();
  state.children.set(key, childState);

  return childState;
}

function isObject<T>(value: T): value is T & object {
  return typeof value === 'object' && value !== null;
}

function proxyObject<T>(
  state: ReactiveState<T>,
  getValue: <T>(state: ReactiveState<T>) => T = takeSnapshot,
): T {
  return new Proxy(state.signal.value as T & object, {
    get(_target, key, _receiver) {
      const childState = getChildState(state, key);
      return getValue(childState);
    },
    set(target, key, value, receiver) {
      const childState = getChildState(state, key);
      if (childState.signal instanceof Atom) {
        childState.children = null;
        childState.flags |= FLAG_PENGING_VALUE;
        childState.flags &= ~FLAG_NEEDS_SNAPSHOT;
        childState.signal.value = value;
        return true;
      } else {
        return Reflect.set(target, key, value, receiver);
      }
    },
  });
}

function resolveChildState<T>(
  state: ReactiveState<T>,
  key: PropertyKey,
): ReactiveState<unknown> {
  let prototype = state.signal.value;

  do {
    const propertyDescriptor = Object.getOwnPropertyDescriptor(prototype, key);

    if (propertyDescriptor !== undefined) {
      const { get, set, value } = propertyDescriptor;

      if (get !== undefined && set !== undefined) {
        return createState(new Atom(get.call(proxyObject(state))));
      } else if (get !== undefined) {
        const dependencies: Signal<unknown>[] = [];
        const proxy = proxyObject(state, (state) => {
          dependencies.push(state.signal);
          return takeSnapshot(state);
        });
        const initialResult = get.call(proxy);
        const initialVersion = dependencies.reduce(
          (version, dependency) => version + dependency.version,
          0,
        );
        const signal = new Computed<unknown>(
          () => get.call(proxyObject(state)),
          dependencies,
          initialResult,
          initialVersion,
        );
        return createState(signal);
      } else {
        return createState(new Atom(value, state.signal.version));
      }
    }

    prototype = Object.getPrototypeOf(prototype);
  } while (prototype !== null && prototype !== Object.prototype);

  return createState(new Atom(undefined, state.signal.version));
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

function takeSnapshot<T>(state: ReactiveState<T>): T {
  const { children, flags, signal } = state;

  if (flags & FLAG_NEEDS_SNAPSHOT) {
    const oldValue = signal.value;

    if (isObject(oldValue)) {
      const newValue = shallowClone(oldValue);

      for (const [key, child] of children!.entries()) {
        if (child !== null && child.flags & FLAG_PENGING_VALUE) {
          (newValue as any)[key] = takeSnapshot(child);
          child.flags &= ~FLAG_PENGING_VALUE;
        }
      }

      // Update the value without invalidation.
      (signal as Atom<T>).poke(newValue);
    }

    state.flags &= ~FLAG_NEEDS_SNAPSHOT;
  }

  return signal.value;
}
