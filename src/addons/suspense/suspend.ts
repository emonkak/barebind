const STATUS_PENDING = 'pending';
const STATUS_FULFILLED = 'fulfilled';
const STATUS_REJECTED = 'rejected';
const STATUS_ABORTED = 'aborted';

export type Suspend<T> = SuspendInternal<T> & SuspendInvariant<T>;

type SuspendClass = typeof SuspendInternal & {
  [Symbol.hasInstance](value: any): value is Suspend<any>;
};

type SuspendInvariant<T> = Readonly<
  | { status: typeof STATUS_PENDING; value: never; reason: never }
  | { status: typeof STATUS_FULFILLED; value: T; reason: never }
  | {
      status: typeof STATUS_REJECTED | typeof STATUS_ABORTED;
      value: never;
      reason: unknown;
    }
>;

type SuspendStatus =
  | typeof STATUS_PENDING
  | typeof STATUS_FULFILLED
  | typeof STATUS_REJECTED
  | typeof STATUS_ABORTED;

class SuspendInternal<T> implements Promise<T> {
  private _status: SuspendStatus;

  private _value: T | undefined;

  private _reason: unknown;

  private readonly _controller: AbortController;

  static await<T>(
    promise: PromiseLike<T>,
    controller?: AbortController,
  ): Suspend<T> {
    const suspend = new SuspendInternal<T>(
      STATUS_PENDING,
      undefined,
      undefined,
      controller,
    );
    const { signal } = suspend._controller;

    promise.then(
      (value) => {
        if (suspend._status === STATUS_PENDING) {
          suspend._status = STATUS_FULFILLED;
          suspend._value = value;
        }
        signal.dispatchEvent(new CustomEvent('fulfill', { detail: value }));
      },
      (reason) => {
        if (suspend._status === STATUS_PENDING) {
          suspend._status = STATUS_REJECTED;
          suspend._reason = reason;
        }
        signal.dispatchEvent(new CustomEvent('reject', { detail: reason }));
      },
    );

    const abortWhenPending = () => {
      if (suspend._status === STATUS_PENDING) {
        suspend._status = STATUS_ABORTED;
        suspend._reason = signal.reason;
      }
    };

    if (signal.aborted) {
      abortWhenPending();
    } else {
      signal.addEventListener('abort', abortWhenPending, { once: true });
    }

    return suspend as Suspend<T>;
  }

  static reject<T>(reason: unknown): Suspend<T> {
    return new SuspendInternal(
      STATUS_REJECTED,
      undefined,
      reason,
    ) as Suspend<T>;
  }

  static resolve<T>(value: T): Suspend<T> {
    return new SuspendInternal(
      STATUS_FULFILLED,
      value,
      undefined,
    ) as Suspend<T>;
  }

  private constructor(
    status: SuspendStatus,
    value: T | undefined,
    reason: unknown,
    controller: AbortController = new AbortController(),
  ) {
    this._status = status;
    this._value = value;
    this._reason = reason;
    this._controller = controller;
  }

  get [Symbol.toStringTag](): string {
    return 'Suspend';
  }

  get status(): SuspendStatus {
    return this._status;
  }

  get value(): T | undefined {
    return this._value;
  }

  get reason(): unknown {
    return this._reason;
  }

  abort(reason?: unknown): void {
    if (this._status === 'pending') {
      this._controller.abort(reason);
    }
  }

  catch<TResult = never>(
    onRejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | undefined
      | null,
  ): Promise<T | TResult> {
    return Promise.prototype.catch.call(this, onRejected);
  }

  finally(onFinally?: (() => void) | null | undefined): Promise<T> {
    return Promise.prototype.finally.call(this, onFinally);
  }

  then<TFulfilled = T, TRejected = never>(
    onFulfilled?:
      | ((value: T) => TFulfilled | PromiseLike<TFulfilled>)
      | undefined
      | null,
    onRejected?:
      | ((reason: any) => TRejected | PromiseLike<TRejected>)
      | undefined
      | null,
  ): Promise<TFulfilled | TRejected> {
    let promise: Promise<T>;
    switch (this._status) {
      case STATUS_PENDING:
        promise = waitUntilSettled(this._controller.signal);
        break;
      case STATUS_FULFILLED:
        promise = Promise.resolve(this._value!);
        break;
      case STATUS_REJECTED:
      case STATUS_ABORTED:
        promise = Promise.reject(this._reason);
        break;
    }
    return promise.then(onFulfilled, onRejected);
  }

  unwrap(): T {
    switch (this._status) {
      case STATUS_PENDING:
        throw this;
      case STATUS_FULFILLED:
        return this._value!;
      case STATUS_REJECTED:
      case STATUS_ABORTED:
        throw this._reason;
    }
  }
}

export const Suspend: SuspendClass = SuspendInternal as SuspendClass;

function waitUntilSettled<T>(signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const eventController = new AbortController();
    signal.addEventListener(
      'fulfill',
      (event) => {
        resolve((event as CustomEvent<T>).detail);
        eventController.abort();
      },
      {
        signal: eventController.signal,
      },
    );
    signal.addEventListener(
      'reject',
      (event) => {
        reject((event as CustomEvent).detail);
        eventController.abort();
      },
      {
        signal: eventController.signal,
      },
    );
    signal.addEventListener(
      'abort',
      () => {
        reject(signal.reason);
        eventController.abort();
      },
      { signal: eventController.signal },
    );
  });
}
