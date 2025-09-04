import { DirectiveError } from '../directive.js';
import {
  type Binding,
  type DirectiveContext,
  type Effect,
  getStartNode,
  type HydrationTarget,
  type Part,
  PartType,
  type Template,
  type TemplateResult,
  type UpdateSession,
} from '../internal.js';

export const HTML_NAMESPACE_URI = 'http://www.w3.org/1999/xhtml';
export const MATH_NAMESPACE_URI = 'http://www.w3.org/1998/Math/MathML';
export const SVG_NAMESPACE_URI = 'http://www.w3.org/2000/svg';

const LEADING_NEWLINE_REGEXP = /^\s*\n/;
const TAILING_NEWLINE_REGEXP = /\n\s*$/;

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
    targetTree: HydrationTarget,
    session: UpdateSession,
  ): TemplateResult;

  resolveBinding(
    binds: TBinds,
    part: Part,
    _context: DirectiveContext,
  ): Binding<TBinds> {
    if (part.type !== PartType.ChildNode) {
      throw new DirectiveError(
        this,
        binds,
        part,
        `${this.constructor.name} must be used in a child node part.`,
      );
    }

    return new TemplateBinding(this, binds, part);
  }
}

export class TemplateBinding<TBinds extends readonly unknown[]>
  implements Binding<TBinds>, Effect
{
  private readonly _type: Template<TBinds>;

  private _binds: TBinds;

  private readonly _part: Part.ChildNodePart;

  private _pendingResult: TemplateResult | null = null;

  private _memoizedResult: TemplateResult | null = null;

  constructor(
    template: Template<TBinds>,
    binds: TBinds,
    part: Part.ChildNodePart,
  ) {
    this._type = template;
    this._binds = binds;
    this._part = part;
  }

  get type(): Template<TBinds> {
    return this._type;
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

  shouldBind(binds: TBinds): boolean {
    return this._memoizedResult === null || binds !== this._binds;
  }

  connect(session: UpdateSession): void {
    if (this._pendingResult !== null) {
      const { slots } = this._pendingResult;

      for (let i = 0, l = slots.length; i < l; i++) {
        slots[i]!.reconcile(this._binds[i]!, session);
      }
    } else {
      const targetTree = session.rootScope.getHydrationTarget();

      if (targetTree !== null) {
        this._pendingResult = this._type.hydrate(
          this._binds,
          this._part,
          targetTree,
          session,
        );
        this._part.anchorNode = getAnchorNode(this._pendingResult);
        this._memoizedResult = this._pendingResult;
      } else {
        this._pendingResult = this._type.render(
          this._binds,
          this._part,
          session,
        );
      }
    }
  }

  disconnect(session: UpdateSession): void {
    if (this._pendingResult !== null) {
      const { slots } = this._pendingResult;

      for (let i = slots.length - 1; i >= 0; i--) {
        slots[i]!.disconnect(session);
      }
    }
  }

  commit(): void {
    if (this._pendingResult !== null) {
      const { childNodes, slots } = this._pendingResult;

      if (this._memoizedResult === null) {
        this._part.node.before(...childNodes);
      }

      for (let i = 0, l = slots.length; i < l; i++) {
        slots[i]!.commit();
      }

      this._part.anchorNode = getAnchorNode(this._pendingResult);
    }

    this._memoizedResult = this._pendingResult;
  }

  rollback(): void {
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
          slot.rollback();
        }
      }

      for (let i = childNodes.length - 1; i >= 0; i--) {
        childNodes[i]!.remove();
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

export function stripWhitespaces(text: string): string {
  if (LEADING_NEWLINE_REGEXP.test(text)) {
    text = text.trimStart();
  }
  if (TAILING_NEWLINE_REGEXP.test(text)) {
    text = text.trimEnd();
  }
  return text;
}

function getAnchorNode({
  childNodes,
  slots,
}: TemplateResult): ChildNode | null {
  if (childNodes.length > 0) {
    return childNodes[0]! === slots[0]?.part.node
      ? getStartNode(slots[0].part)
      : childNodes[0]!;
  } else {
    return null;
  }
}
