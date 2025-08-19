import { HookType, Lanes, type RenderSessionContext } from '@/internal.js';
import { RenderSession } from '@/render-session.js';
import { Runtime } from '@/runtime.js';
import { MockBackend, MockCoroutine } from './mocks.js';

export function createSession(lanes: Lanes = -1): RenderSession {
  return new RenderSession(
    lanes,
    [],
    new MockCoroutine(),
    Runtime.create(new MockBackend()),
  );
}

export function disposeSession(session: RenderSession): void {
  for (let i = session['_hooks'].length - 1; i >= 0; i--) {
    const hook = session['_hooks'][i]!;
    if (
      hook.type === HookType.Effect ||
      hook.type === HookType.LayoutEffect ||
      hook.type === HookType.InsertionEffect
    ) {
      hook.cleanup?.();
      hook.cleanup = undefined;
    }
  }
}

export function flushSession(session: RenderSession): void {
  session.finalize();
  session['_context'].flushSync(Lanes.NoLanes);
  session['_hookIndex'] = 0;
}

export async function waitForUpdate(
  context: RenderSessionContext,
): Promise<number> {
  const updateHandles = context.getUpdateHandles();
  const promises = Array.from(
    updateHandles,
    (updateHandle) => updateHandle.promise,
  );
  return (await Promise.allSettled(promises)).length;
}
