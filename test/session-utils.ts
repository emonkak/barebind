import { HookType, Lanes, type RenderSessionContext } from '@/internal.js';
import { RenderSession } from '@/render-session.js';
import { createRuntime, type RuntimeOptions } from '@/runtime.js';
import { UpdateSession } from '@/update-session.js';
import { MockBackend, MockCoroutine } from './mocks.js';

export function createRenderSession(
  lanes: Lanes = -1,
  options?: RuntimeOptions,
): RenderSession {
  const runtime = createRuntime(new MockBackend(), options);
  return new RenderSession(
    lanes,
    [],
    new MockCoroutine(),
    UpdateSession.create(runtime),
  );
}

export function createUpdateSession(options?: RuntimeOptions): UpdateSession {
  const runtime = createRuntime(new MockBackend(), options);
  return UpdateSession.create(runtime);
}

export function disposeRenderSession(session: RenderSession): void {
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

export function flushRenderSession(session: RenderSession): void {
  session.finalize();
  session['_context'].flushSync(Lanes.NoLanes);
  session['_hookIndex'] = 0;
}

export async function waitForAll(
  context: RenderSessionContext,
): Promise<number> {
  const updateHandles = context.getUpdateHandles();
  const promises = Array.from(
    updateHandles,
    (updateHandle) => updateHandle.promise,
  );
  return (await Promise.allSettled(promises)).length;
}
