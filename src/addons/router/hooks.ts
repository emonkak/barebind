import type { HookFunction } from '../../component/stateful-component.js';
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

export function SyncNavigationScene(
  adapter: NavigationAdapter,
): HookFunction<NavigationScene> {
  return (context) => {
    const [scene, setScene] = context.useState<NavigationScene>(() => ({
      url: adapter.getCurrentURL(),
      state: adapter.getCurrentState(),
      navigationType: null,
    }));

    context.useEffect(() => {
      return adapter.listen((scene, interceptor) => {
        interceptor.intercept({
          handler: () => setScene(scene).finished,
        });
      });
    }, [adapter]);

    context.provide(new NavigationContext(adapter, scene));

    return scene;
  };
}
