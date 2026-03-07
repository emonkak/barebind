const STATUS_PENDING = 'pending';
const STATUS_FULFILLED = 'fulfilled';
const STATUS_REJECTED = 'rejected';
const STATUS_ABORTED = 'aborted';

type SuspendClass = typeof SuspendInternal & {
  [Symbol.hasInstance](value: any): value is Suspend<any>;
};

type SuspendStatus =
  | typeof STATUS_PENDING
  | typeof STATUS_FULFILLED
  | typeof STATUS_REJECTED
  | typeof STATUS_ABORTED;

type SuspendInvariant<T> = Readonly<
  | { status: typeof STATUS_PENDING; value: never; reason: never }
  | { status: typeof STATUS_FULFILLED; value: T; reason: never }
  | {
      status: typeof STATUS_REJECTED | typeof STATUS_ABORTED;
      value: never;
      reason: unknown;
    }
>;

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: catch/finally are safely assigned via prototype
class SuspendInternal<T> implements PromiseLike<T> {
  private readonly _promise: PromiseLike<T>;

  private readonly _controller: AbortController;

  private _status: SuspendStatus = STATUS_PENDING;

  private _value: T | undefined;

  private _reason: unknown;

  static await<T>(
    promise: PromiseLike<T>,
    controller: AbortController,
  ): Suspend<T> {
    const suspend = new SuspendInternal(promise, controller);

    promise.then(
      (value) => {
        if (suspend._status === STATUS_PENDING) {
          suspend._status = STATUS_FULFILLED;
          suspend._value = value;
        }
      },
      (reason) => {
        if (suspend._status === STATUS_PENDING) {
          suspend._status = STATUS_REJECTED;
          suspend._reason = reason;
        }
      },
    );

    controller.signal.addEventListener(
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

  private constructor(promise: PromiseLike<T>, controller: AbortController) {
    this._promise = promise;
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
        promise = Promise.race([
          this._promise,
          waitForAbort<T>(this._controller.signal),
        ]);
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

export type Suspend<T> = SuspendInternal<T> & SuspendInvariant<T>;

export const Suspend: SuspendClass = SuspendInternal as SuspendClass;

function waitForAbort<T>(signal: AbortSignal): Promise<T> {
  return new Promise<T>((_resolve, reject) => {
    signal.addEventListener(
      'abort',
      () => {
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
