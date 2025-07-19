import {
  type Binding,
  type CommitContext,
  type DirectiveContext,
  type Effect,
  getStartNode,
  HydrationError,
  type HydrationTree,
  type Part,
  PartType,
  type Template,
  type TemplateResult,
  type UpdateContext,
} from '../core.js';
import { debugPart, markUsedValue } from '../debug.js';
import { DirectiveSpecifier } from '../directive.js';

export const HTML_NAMESPACE_URI = 'http://www.w3.org/1999/xhtml';
export const MATH_NAMESPACE_URI = 'http://www.w3.org/1998/Math/MathML';
export const SVG_NAMESPACE_URI = 'http://www.w3.org/2000/svg';

const LEADING_NEWLINE_REGEXP = /^\s*\n/;
const TAILING_NEWLINE_REGEXP = /\n\s*$/;

const START_TAG_PATTERN = /^<(?:!--\s*)?$/;
const END_TAG_PATTERN = /^\s*(?:\/|--)?>$/;

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
    context: UpdateContext,
  ): TemplateResult;

  abstract hydrate(
    binds: TBinds,
    part: Part.ChildNodePart,
    hydrationTree: HydrationTree,
    context: UpdateContext,
  ): TemplateResult;

  resolveBinding(
    binds: TBinds,
    part: Part,
    _context: DirectiveContext,
  ): Binding<TBinds> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        `${this.constructor.name} must be used in a child node part, but it is used here in:\n` +
          debugPart(part, markUsedValue(new DirectiveSpecifier(this, binds))),
      );
    }

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

  get part(): Part.ChildNodePart {
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
        'Hydration is failed because the binding has already been initilized.',
      );
    }

    this._pendingResult = this._template.hydrate(
      this._binds,
      this._part,
      hydrationTree,
      context,
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
      this._pendingResult = this._template.render(
        this._binds,
        this._part,
        context,
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

  commit(context: CommitContext): void {
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

  rollback(context: CommitContext): void {
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

export function isIsolatedTagInterpolation(
  precedingText: string,
  followingText: string,
): boolean {
  return (
    START_TAG_PATTERN.test(precedingText) && END_TAG_PATTERN.test(followingText)
  );
}

export function normalizeText(text: string): string {
  if (LEADING_NEWLINE_REGEXP.test(text)) {
    text = text.trimStart();
  }
  if (TAILING_NEWLINE_REGEXP.test(text)) {
    text = text.trimEnd();
  }
  return text;
}
