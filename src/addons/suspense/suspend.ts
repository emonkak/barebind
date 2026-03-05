type SuspendClass = typeof SuspendInternal & {
  [Symbol.hasInstance](value: any): value is Suspend<any>;
};

type SuspendStatus = 'pending' | 'fulfilled' | 'rejected' | 'aborted';

type SuspendInvariant<T> = Readonly<
  | { status: 'pending'; value: never; reason: never }
  | { status: 'fulfilled'; value: T; reason: never }
  | { status: 'rejected' | 'aborted'; value: never; reason: unknown }
>;

class SuspendInternal<T> implements PromiseLike<T> {
  private readonly _promise: PromiseLike<T>;

  private readonly _controller: AbortController;

  private _status: SuspendStatus = 'pending';

  private _value: T | undefined;

  private _reason: unknown;

  private _refCount: number = 0;

  static await<T>(
    promise: PromiseLike<T>,
    controller: AbortController,
  ): Suspend<T> {
    const suspend = new SuspendInternal(promise, controller);

    promise.then(
      (value) => {
        suspend._status = 'fulfilled';
        suspend._value = value;
      },
      (reason) => {
        suspend._status = 'rejected';
        suspend._reason = reason;
      },
    );

    controller.signal.addEventListener('abort', () => {
      suspend._status = 'aborted';
      suspend._reason = controller.signal.reason;
    });

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
    if (this._status === 'pending') {
      this._controller.abort(reason);
    }
  }

  release(): void {
    if (--this._refCount === 0) {
      this.abort();
    }
  }

  retain(): void {
    this._refCount++;
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
      case 'pending': {
        promise = Promise.race([
          this._promise,
          waitForAbort<T>(this._controller.signal),
        ]);
        break;
      }
      case 'fulfilled':
        promise = Promise.resolve(this._value!);
        break;
      case 'rejected':
      case 'aborted':
        promise = Promise.reject(this._reason);
        break;
    }
    return promise.then(onFulfilled, onRejected);
  }

  unwrap(): T {
    switch (this._status) {
      case 'pending':
        throw this;
      case 'fulfilled':
        return this._value!;
      case 'rejected':
      case 'aborted':
        throw this._reason;
    }
  }
}

export type Suspend<T> = SuspendInternal<T> & SuspendInvariant<T>;

export const Suspend: SuspendClass = SuspendInternal as SuspendClass;

function waitForAbort<T>(signal: AbortSignal): Promise<T> {
  return new Promise<T>((_resolve, reject) => {
    signal.addEventListener('abort', () => {
      reject(signal.reason);
    });
  });
}
