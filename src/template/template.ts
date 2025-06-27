import type {
  Binding,
  Effect,
  Template,
  TemplateBlock,
  UpdateContext,
} from '../directive.js';
import { HydrationError, type HydrationTree } from '../hydration.js';
import { type ChildNodePart, getStartNode, PartType } from '../part.js';

export class TemplateBinding<TBinds extends readonly unknown[]>
  implements Binding<TBinds>, Effect
{
  private readonly _template: Template<TBinds>;

  private _binds: TBinds;

  private readonly _part: ChildNodePart;

  private _pendingBlock: TemplateBlock | null = null;

  private _memoizedBlock: TemplateBlock | null = null;

  constructor(template: Template<TBinds>, binds: TBinds, part: ChildNodePart) {
    this._template = template;
    this._binds = binds;
    this._part = part;
  }

  get directive(): Template<TBinds> {
    return this._template;
  }

  get value(): TBinds {
    return this._binds;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  shouldBind(binds: TBinds): boolean {
    return this._memoizedBlock === null || binds !== this._binds;
  }

  bind(binds: TBinds): void {
    this._binds = binds;
  }

  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void {
    if (this._pendingBlock !== null) {
      throw new HydrationError(
        'Hydration is failed because the template has already been rendered.',
      );
    }

    this._pendingBlock = context.hydrateTemplate(
      this._template,
      this._binds,
      this._part,
      hydrationTree,
    );
  }

  connect(context: UpdateContext): void {
    if (this._pendingBlock !== null) {
      const { slots } = this._pendingBlock;

      for (let i = 0, l = slots.length; i < l; i++) {
        slots[i]!.reconcile(this._binds[i]!, context);
      }
    } else {
      this._pendingBlock = context.renderTemplate(
        this._template,
        this._binds,
        this._part,
      );
    }
  }

  disconnect(context: UpdateContext): void {
    if (this._pendingBlock !== null) {
      const { slots } = this._pendingBlock;

      for (let i = slots.length - 1; i >= 0; i--) {
        slots[i]!.disconnect(context);
      }
    }
  }

  commit(): void {
    if (this._pendingBlock !== null) {
      const { childNodes, slots } = this._pendingBlock;

      if (this._memoizedBlock === null) {
        this._part.node.before(...childNodes);
      }

      for (let i = 0, l = slots.length; i < l; i++) {
        const slot = slots[i]!;

        DEBUG: {
          if (slot.part.type === PartType.ChildNode) {
            slot.part.node.nodeValue = '/' + slot.directive.name;
          }
        }

        slot.commit();
      }

      if (childNodes.length > 0) {
        this._part.childNode =
          childNodes[0]! === slots[0]?.part.node
            ? getStartNode(slots[0].part)
            : childNodes[0]!;
      } else {
        this._part.childNode = null;
      }
    }

    this._memoizedBlock = this._pendingBlock;
  }

  rollback(): void {
    if (this._memoizedBlock !== null) {
      const { childNodes, slots } = this._memoizedBlock;

      for (let i = slots.length - 1; i >= 0; i--) {
        const slot = slots[i]!;

        if (
          (slot.part.type === PartType.ChildNode ||
            slot.part.type === PartType.Text) &&
          childNodes.includes(slot.part.node)
        ) {
          // This binding is mounted as a child of the root, so we must rollback it.
          slot.rollback();
        }

        DEBUG: {
          if (slot.part.type === PartType.ChildNode) {
            slot.part.node.nodeValue = '';
          }
        }
      }

      for (let i = childNodes.length - 1; i >= 0; i--) {
        childNodes[i]!.remove();
      }
    }

    this._part.childNode = null;
    this._memoizedBlock = null;
  }
}
