import { BrowserBackend } from '@/runtime/browser.js';

export class TestBackend extends BrowserBackend {
  override requestCallback<T>(callback: () => T | PromiseLike<T>): Promise<T> {
    return Promise.resolve().then(callback);
  }

  override yieldToMain(): Promise<void> {
    return Promise.resolve();
  }
}
