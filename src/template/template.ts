import type {
  Binding,
  Effect,
  EffectContext,
  Template,
  TemplateResult,
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

  private _pendingResult: TemplateResult | null = null;

  private _memoizedResult: TemplateResult | null = null;

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
    return this._memoizedResult === null || binds !== this._binds;
  }

  bind(binds: TBinds): void {
    this._binds = binds;
  }

  hydrate(hydrationTree: HydrationTree, context: UpdateContext): void {
    if (this._pendingResult !== null) {
      throw new HydrationError(
        'Hydration is failed because the template has already been rendered.',
      );
    }

    this._pendingResult = context.hydrateTemplate(
      this._template,
      this._binds,
      this._part,
      hydrationTree,
    );
    this._memoizedResult = this._pendingResult;
  }

  connect(context: UpdateContext): void {
    if (this._pendingResult !== null) {
      const { slots } = this._pendingResult;

      for (let i = 0, l = slots.length; i < l; i++) {
        slots[i]!.reconcile(this._binds[i]!, context);
      }
    } else {
      this._pendingResult = context.renderTemplate(
        this._template,
        this._binds,
        this._part,
      );
    }
  }

  disconnect(context: UpdateContext): void {
    if (this._pendingResult !== null) {
      const { slots } = this._pendingResult;

      for (let i = slots.length - 1; i >= 0; i--) {
        slots[i]!.disconnect(context);
      }
    }
  }

  commit(context: EffectContext): void {
    if (this._pendingResult !== null) {
      const { childNodes, slots } = this._pendingResult;

      if (this._memoizedResult === null) {
        this._part.node.before(...childNodes);
      }

      for (let i = 0, l = slots.length; i < l; i++) {
        slots[i]!.commit(context);
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

    this._memoizedResult = this._pendingResult;
  }

  rollback(context: EffectContext): void {
    if (this._memoizedResult !== null) {
      const { childNodes, slots } = this._memoizedResult;

      for (let i = slots.length - 1; i >= 0; i--) {
        const slot = slots[i]!;

        if (
          (slot.part.type === PartType.ChildNode ||
            slot.part.type === PartType.Text) &&
          childNodes.includes(slot.part.node)
        ) {
          // This binding is mounted as a child of the root, so we must rollback it.
          slot.rollback(context);
        }
      }

      for (let i = childNodes.length - 1; i >= 0; i--) {
        childNodes[i]!.remove();
      }
    }

    this._part.childNode = null;
    this._memoizedResult = null;
  }
}
