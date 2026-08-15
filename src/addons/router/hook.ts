import type { UpdateOptions } from '../../base.js';
import type { HookFunction } from '../../component.js';
import type { NavigationAdapter, NavigationScene } from './adapter.js';

export class NavigationContext {
  readonly adapter: NavigationAdapter;
  readonly scene: NavigationScene;

  constructor(adapter: NavigationAdapter, scene: NavigationScene) {
    this.adapter = adapter;
    this.scene = scene;
    DEBUG: {
      Object.freeze(this);
    }
  }
}

export function SyncNavigation(
  adapter: NavigationAdapter,
  deriveUpdateOptions?: (scene: NavigationScene) => UpdateOptions,
): HookFunction<NavigationContext> {
  return (context) => {
    const [scene, setScene] = context.useState<NavigationScene>(() => ({
      url: adapter.getCurrentURL(),
      state: adapter.getCurrentState(),
      navigationType: null,
    }));

    context.useEffect(() => {
      return adapter.listen((scene, interceptor) => {
        interceptor.intercept({
          async handler() {
            const options = deriveUpdateOptions?.(scene);
            await setScene(scene, options).finished;
            interceptor.scroll();
          },
        });
      });
    }, [adapter]);

    const navigationContext = new NavigationContext(adapter, scene);

    context.provide(navigationContext);

    return navigationContext;
  };
}
