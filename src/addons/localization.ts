import { $hook, type RenderContext } from '../internal.js';

const $LocaleContext = Symbol('$LocaleContext');

export type LocaleMessages = Record<string, (...args: any[]) => any>;

export class LocaleContext<TMessages extends LocaleMessages> {
  private readonly _messages: TMessages;

  static [$hook]<TMessages extends LocaleMessages>(
    context: RenderContext,
  ): LocaleContext<TMessages> {
    const localeContext = context.getSharedContext($LocaleContext);

    if (localeContext === undefined) {
      throw new Error(
        'No locale context found. Make sure to register LocaleContext instance with context.use() before using LocaleContext.',
      );
    }

    return localeContext as LocaleContext<TMessages>;
  }

  constructor(messages: TMessages) {
    this._messages = messages;
  }

  [$hook](context: RenderContext): void {
    context.setSharedContext($LocaleContext, this);
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
