import { SharedContext } from '../shared-context.js';

export type LocaleMessages = Record<string, (...args: any[]) => any>;

export class LocaleContext<
  TMessages extends LocaleMessages,
> extends SharedContext {
  private readonly _messages: TMessages;

  constructor(messages: TMessages) {
    super();
    this._messages = messages;
  }

  localize<TKey extends keyof TMessages>(
    key: TKey,
    ...args: Parameters<TMessages[TKey]>
  ): ReturnType<TMessages[TKey]> {
    DEBUG: {
      if (this._messages[key] === undefined) {
        throw new Error(`No message found for key "${String(key)}" in locale.`);
      }
    }

    return this._messages[key](...args);
  }
}
