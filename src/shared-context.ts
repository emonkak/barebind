import {
  $hook,
  type HookObject,
  type RenderContext,
} from './render-context.js';

export abstract class SharedContext implements HookObject<void> {
  static [$hook]<T extends SharedContext>(
    this: { new (...args: any[]): T },
    context: RenderContext,
  ): T {
    const sharedContext = context.getSharedContext<T>(this);

    if (sharedContext === undefined) {
      throw new Error(
        `No ${this.name} found. Make sure to register its instance with context.use() before using it.`,
      );
    }

    return sharedContext;
  }

  [$hook](context: RenderContext): void {
    context.setSharedContext(this.constructor, this);
  }
}
