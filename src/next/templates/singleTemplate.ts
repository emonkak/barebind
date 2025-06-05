import type {
  Bindable,
  DirectiveContext,
  Slot,
  Template,
  TemplateBlock,
  UpdateContext,
} from '../core.js';
import { inspectPart, markUsedValue } from '../debug.js';
import type { HydrationTree } from '../hydration.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';
import { TemplateBinding } from './template.js';

export const ChildNodeTemplate: Template<readonly [Bindable<any>]> = {
  name: 'ChildNodeTemplate',
  render(
    binds: readonly [Bindable<unknown>],
    context: DirectiveContext,
  ): SingleTemplateBlock<unknown> {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    const slot = context.resolveSlot(binds[0], part);
    DEBUG: {
      part.node.data = slot.directive.name;
    }
    return new SingleTemplateBlock(slot);
  },
  hydrate(
    binds: readonly [Bindable<unknown>],
    hydrationTree: HydrationTree,
    context: DirectiveContext,
  ): SingleTemplateBlock<unknown> {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;
    const slot = context.resolveSlot(binds[0], part);
    DEBUG: {
      part.node.data = slot.directive.name;
    }
    hydrationTree.popComment().replaceWith(part.node);
    return new SingleTemplateBlock(slot);
  },
  resolveBinding(
    binds: readonly [Bindable<unknown>],
    part: Part,
    _context: DirectiveContext,
  ): TemplateBinding<readonly [unknown]> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'ChildNodeTemplate must be used in a child node, but it is used here in:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new TemplateBinding(this, binds, part);
  },
};

export const TextTemplate: Template<readonly [Bindable<any>]> = {
  name: 'TextTemplate',
  render(
    binds: readonly [Bindable<unknown>],
    context: DirectiveContext,
  ): SingleTemplateBlock<unknown> {
    const part = {
      type: PartType.Text,
      node: document.createTextNode(''),
    } as const;
    const value = binds[0];
    const slot = context.resolveSlot(value, part);
    return new SingleTemplateBlock(slot);
  },
  hydrate(
    binds: readonly [Bindable<unknown>],
    hydrationTree: HydrationTree,
    context: DirectiveContext,
  ): SingleTemplateBlock<unknown> {
    const part = {
      type: PartType.Text,
      node: hydrationTree.peekText(),
    } as const;
    const value = binds[0];
    const slot = context.resolveSlot(value, part);
    hydrationTree.popNode();
    return new SingleTemplateBlock(slot);
  },
  resolveBinding(
    binds: readonly [Bindable<unknown>],
    part: Part,
    _context: DirectiveContext,
  ): TemplateBinding<readonly [unknown]> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'TextTemplate must be used in a child node, but it is used here in:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new TemplateBinding(this, binds, part);
  },
};

export class SingleTemplateBlock<T>
  implements TemplateBlock<readonly [Bindable<T>]>
{
  private _slot: Slot<T>;

  constructor(slot: Slot<T>) {
    this._slot = slot;
  }

  reconcile(binds: readonly [Bindable<T>], context: UpdateContext): void {
    this._slot.reconcile(binds[0], context);
  }

  connect(context: UpdateContext): void {
    this._slot.connect(context);
  }

  disconnect(context: UpdateContext): void {
    this._slot.disconnect(context);
  }

  commit(): void {
    DEBUG: {
      if (this._slot.part.type === PartType.ChildNode) {
        this._slot.part.node.nodeValue = this._slot.directive.name;
      }
    }
    this._slot.commit();
  }

  rollback(): void {
    this._slot.rollback();
  }

  mount(part: ChildNodePart): void {
    part.node.before(this._slot.part.node);
  }

  unmount(_part: ChildNodePart): void {
    this._slot.part.node.remove();
  }
}
