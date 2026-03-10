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

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: catch/finally are safely assigned via prototype
class SuspendInternal<T> implements PromiseLike<T> {
  private _status: SuspendStatus;

  private _value: T | undefined;

  private _reason: unknown;

  private readonly _controller: AbortController;

  static await<T>(
    promise: PromiseLike<T>,
    controller: AbortController,
  ): Suspend<T> {
    const suspend = new SuspendInternal<T>(
      STATUS_PENDING,
      undefined,
      undefined,
      controller,
    );
    const { signal } = controller;

    promise.then(
      (value) => {
        if (suspend._status === STATUS_PENDING) {
          suspend._status = STATUS_FULFILLED;
          suspend._value = value;
        }
        signal.dispatchEvent(new Event('fulfill'));
      },
      (reason) => {
        if (suspend._status === STATUS_PENDING) {
          suspend._status = STATUS_REJECTED;
          suspend._reason = reason;
        }
        signal.dispatchEvent(new Event('reject'));
      },
    );

    signal.addEventListener(
      'abort',
      () => {
        if (suspend._status === STATUS_PENDING) {
          suspend._status = STATUS_ABORTED;
          suspend._reason = controller.signal.reason;
        }
      },
      { once: true },
    );

    return suspend as Suspend<T>;
  }

  static reject<T>(reason: unknown, controller: AbortController): Suspend<T> {
    return new SuspendInternal(
      STATUS_REJECTED,
      undefined,
      reason,
      controller,
    ) as Suspend<T>;
  }

  static resolve<T>(value: T, controller: AbortController): Suspend<T> {
    return new SuspendInternal(
      STATUS_FULFILLED,
      value,
      undefined,
      controller,
    ) as Suspend<T>;
  }

  private constructor(
    status: SuspendStatus,
    value: T | undefined,
    reason: unknown,
    controller: AbortController,
  ) {
    this._status = status;
    this._value = value;
    this._reason = reason;
    this._controller = controller;
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
    this._controller.abort(reason);
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
        promise = new Promise<T>((resolve, reject) => {
          const signal = this._controller.signal;
          const eventController = new AbortController();
          const eventSignal = eventController.signal;
          signal.addEventListener(
            'fulfill',
            () => {
              resolve(this._value!);
              eventController.abort();
            },
            {
              signal: eventSignal,
            },
          );
          signal.addEventListener(
            'reject',
            () => {
              reject(this._reason);
              eventController.abort();
            },
            {
              signal: eventSignal,
            },
          );
          signal.addEventListener(
            'abort',
            () => {
              reject(this._controller.signal.reason);
              eventController.abort();
            },
            { signal: eventSignal },
          );
        });
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

interface SuspendInternal<T> extends Promise<T> {}

SuspendInternal.prototype.catch = Promise.prototype.catch;
SuspendInternal.prototype.finally = Promise.prototype.finally;

export const Suspend: SuspendClass = SuspendInternal as SuspendClass;
