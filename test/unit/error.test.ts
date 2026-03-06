import { describe, expect, it } from 'vitest';
import { ComponentBinding, createComponent } from '@/component.js';
import { type Coroutine, createScope, Lane, PartType } from '@/core.js';
import { RenderError } from '@/error.js';
import { HTML_NAMESPACE_URI } from '@/template/template.js';

describe('RenderError', () => {
  it('contains the coroutine stack in the message', () => {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
      anchorNode: null,
      namespaceURI: HTML_NAMESPACE_URI,
    };
    const scope = createScope(
      createScope(createScope(), new ComponentBinding(Parent, {}, part)),
      new ComponentBinding(Child, {}, part),
    );
    const coroutine: Coroutine = {
      name: 'ErrorPlace',
      pendingLanes: Lane.NoLane,
      scope,
      resume() {},
    };
    const error = new RenderError(coroutine);

    expect(error.message).toBe(`An error occurred while rendering.
${Parent.name}
\`- ${Child.name}
   \`- ErrorPlace <- ERROR occurred here!`);
  });
});

const Parent = createComponent(function Parent() {});

const Child = createComponent(function Child() {});
