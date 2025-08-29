import { formatPart } from '../debug/part.js';
import { markUsedValue } from '../debug/value.js';
import { DirectiveSpecifier } from '../directive.js';
import {
  type Binding,
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
    context: UpdateContext,
  ): TemplateResult;

  abstract hydrate(
    binds: TBinds,
    part: Part.ChildNodePart,
    target: HydrationTree,
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
          formatPart(part, markUsedValue(new DirectiveSpecifier(this, binds))),
      );
    }

    return new TemplateBinding(this, binds, part);
  }
}

export class TemplateBinding<TBinds extends readonly unknown[]>
  implements Binding<TBinds>, Effect
{
  readonly type: Template<TBinds>;

  value: TBinds;

  readonly part: Part.ChildNodePart;

  private _memoizedValue: TBinds | null = null;

  private _pendingResult: TemplateResult | null = null;

  private _memoizedResult: TemplateResult | null = null;

  constructor(
    template: Template<TBinds>,
    binds: TBinds,
    part: Part.ChildNodePart,
  ) {
    this.type = template;
    this.value = binds;
    this.part = part;
  }

  shouldBind(value: TBinds): boolean {
    return this._memoizedValue === null || value !== this._memoizedValue;
  }

  hydrate(target: HydrationTree, context: UpdateContext): void {
    if (this._pendingResult !== null) {
      throw new HydrationError(
        'Hydration is failed because the binding has already been initialized.',
      );
    }

    const result = this.type.hydrate(this.value, this.part, target, context);

    this.part.anchorNode = getAnchorNode(result);
    this._memoizedValue = this.value;
    this._pendingResult = result;
    this._memoizedResult = result;
  }

  connect(context: UpdateContext): void {
    if (this._pendingResult !== null) {
      const { slots } = this._pendingResult;

      for (let i = 0, l = slots.length; i < l; i++) {
        slots[i]!.reconcile(this.value[i]!, context);
      }
    } else {
      this._pendingResult = this.type.render(this.value, this.part, context);
    }

    this._memoizedValue = this.value;
  }

  disconnect(context: UpdateContext): void {
    if (this._pendingResult !== null) {
      const { slots } = this._pendingResult;

      for (let i = slots.length - 1; i >= 0; i--) {
        slots[i]!.disconnect(context);
      }
    }
  }

  commit(): void {
    if (this._pendingResult !== null) {
      const { childNodes, slots } = this._pendingResult;

      if (this._memoizedResult === null) {
        this.part.node.before(...childNodes);
      }

      for (let i = 0, l = slots.length; i < l; i++) {
        slots[i]!.commit();
      }

      this.part.anchorNode = getAnchorNode(this._pendingResult);
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

    this.part.anchorNode = null;
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
