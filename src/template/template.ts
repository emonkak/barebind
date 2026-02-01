import { ensurePartType } from '../directive.js';
import {
  type Binding,
  type DirectiveContext,
  type Effect,
  getHydrationTargetTree,
  getStartNode,
  type Part,
  PartType,
  type Template,
  type TemplateResult,
  type UpdateSession,
} from '../internal.js';

export const HTML_NAMESPACE_URI = 'http://www.w3.org/1999/xhtml';
export const MATH_NAMESPACE_URI = 'http://www.w3.org/1998/Math/MathML';
export const SVG_NAMESPACE_URI = 'http://www.w3.org/2000/svg';

export abstract class AbstractTemplate<TBinds extends readonly unknown[]>
  implements Template<TBinds>
{
  abstract get arity(): TBinds['length'];

  get name(): string {
    return this.constructor.name;
  }

  abstract render(
    binds: TBinds,
    part: Part.ChildNodePart,
    session: UpdateSession,
  ): TemplateResult;

  abstract hydrate(
    binds: TBinds,
    part: Part.ChildNodePart,
    targetTree: TreeWalker,
    session: UpdateSession,
  ): TemplateResult;

  resolveBinding(
    binds: TBinds,
    part: Part,
    _context: DirectiveContext,
  ): Binding<TBinds> {
    ensurePartType<Part.ChildNodePart>(PartType.ChildNode, this, binds, part);
    return new TemplateBinding(this, binds, part);
  }
}

export class TemplateBinding<TBinds extends readonly unknown[]>
  implements Binding<TBinds>, Effect
{
  private readonly _template: Template<TBinds>;

  private _binds: TBinds;

  private readonly _part: Part.ChildNodePart;

  private _pendingResult: TemplateResult | null = null;

  private _memoizedResult: TemplateResult | null = null;

  constructor(
    template: Template<TBinds>,
    binds: TBinds,
    part: Part.ChildNodePart,
  ) {
    this._template = template;
    this._binds = binds;
    this._part = part;
  }

  get type(): Template<TBinds> {
    return this._template;
  }

  get value(): TBinds {
    return this._binds;
  }

  set value(binds: TBinds) {
    this._binds = binds;
  }

  get part(): Part.ChildNodePart {
    return this._part;
  }

  shouldUpdate(binds: TBinds): boolean {
    return this._memoizedResult === null || binds !== this._binds;
  }

  attach(session: UpdateSession): void {
    if (this._pendingResult !== null) {
      const { slots } = this._pendingResult;

      for (let i = 0, l = slots.length; i < l; i++) {
        slots[i]!.reconcile(this._binds[i]!, session);
      }
    } else {
      const targetTree = getHydrationTargetTree(session.originScope);

      if (targetTree !== null) {
        this._pendingResult = this._template.hydrate(
          this._binds,
          this._part,
          targetTree,
          session,
        );
        this._part.anchorNode = getAnchorNode(this._pendingResult);
        this._memoizedResult = this._pendingResult;
      } else {
        this._pendingResult = this._template.render(
          this._binds,
          this._part,
          session,
        );
      }
    }
  }

  detach(session: UpdateSession): void {
    if (this._pendingResult !== null) {
      const { slots } = this._pendingResult;

      for (let i = 0, l = slots.length; i < l; i++) {
        slots[i]!.detach(session);
      }
    }
  }

  commit(): void {
    if (this._pendingResult !== null) {
      const { children, slots } = this._pendingResult;

      if (this._memoizedResult === null) {
        this._part.node.before(...children);
      }

      for (const slot of slots) {
        slot.commit();
      }

      this._part.anchorNode = getAnchorNode(this._pendingResult);
    }

    this._memoizedResult = this._pendingResult;
  }

  rollback(): void {
    if (this._memoizedResult !== null) {
      const { children, slots } = this._memoizedResult;

      for (const slot of slots) {
        if (
          (slot.part.type === PartType.ChildNode ||
            slot.part.type === PartType.Text) &&
          children.includes(slot.part.node)
        ) {
          // This binding is mounted as a child of the root, so we must rollback it.
          slot.rollback();
        }
      }

      for (const child of children) {
        child.remove();
      }
    }

    this._part.anchorNode = null;
    this._memoizedResult = null;
  }
}

export function getNamespaceURIByTagName(tagName: string): string | null {
  switch (tagName.toLowerCase()) {
    case 'html':
      return HTML_NAMESPACE_URI;
    case 'math':
      return MATH_NAMESPACE_URI;
    case 'svg':
      return SVG_NAMESPACE_URI;
    default:
      return null;
  }
}

function getAnchorNode({ children, slots }: TemplateResult): ChildNode | null {
  if (children.length > 0) {
    return children[0]! === slots[0]?.part.node
      ? getStartNode(slots[0]!.part)
      : children[0]!;
  } else {
    return null;
  }
}
