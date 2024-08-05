import {
  type Binding,
  BindingStatus,
  type ChildNodePart,
  type Directive,
  type DirectiveContext,
  type Part,
  PartType,
  type UpdateContext,
  directiveTag,
} from '../baseTypes.js';
import { ensureDirective, reportPart } from '../error.js';

export function unsafeHTML(content: string): UnsafeHTML {
  return new UnsafeHTML(content);
}

export class UnsafeHTML implements Directive<UnsafeHTML> {
  private readonly _content: string;

  constructor(content: string) {
    this._content = content;
  }

  get content(): string {
    return this._content;
  }

  [directiveTag](part: Part, _context: DirectiveContext): UnsafeHTMLBinding {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'UnsafeHTML directive must be used in a child node, but it is used here:\n' +
          reportPart(part),
      );
    }
    return new UnsafeHTMLBinding(this, part);
  }
}

export class UnsafeHTMLBinding implements Binding<UnsafeHTML> {
  private _value: UnsafeHTML;

  private readonly _part: ChildNodePart;

  private _memoizedContent = '';

  private _childNodes: ChildNode[] = [];

  private _status = BindingStatus.Committed;

  constructor(value: UnsafeHTML, part: ChildNodePart) {
    this._value = value;
    this._part = part;
  }

  get value(): UnsafeHTML {
    return this._value;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._childNodes[0] ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  connect(context: UpdateContext<unknown>): void {
    this._requestMutation(context, BindingStatus.Mounting);
  }

  bind(newValue: UnsafeHTML, context: UpdateContext<unknown>): void {
    DEBUG: {
      ensureDirective(UnsafeHTML, newValue, this._part);
    }
    if (newValue.content !== this._memoizedContent) {
      this._requestMutation(context, BindingStatus.Mounting);
    }
    this._value = newValue;
  }

  unbind(context: UpdateContext<unknown>): void {
    if (this._memoizedContent !== '') {
      this._requestMutation(context, BindingStatus.Unmounting);
    }
  }

  disconnect(): void {}

  commit(): void {
    switch (this._status) {
      case BindingStatus.Mounting: {
        const { content } = this._value;

        for (let i = 0, l = this._childNodes.length; i < l; i++) {
          this._childNodes[i]!.remove();
        }

        if (content !== '') {
          const template = document.createElement('template');
          const reference = this._part.node;

          template.innerHTML = content;

          this._childNodes = [...template.content.childNodes];

          reference.before(template.content);
        } else {
          this._childNodes = [];
        }

        this._memoizedContent = content;
        break;
      }
      case BindingStatus.Unmounting: {
        for (let i = 0, l = this._childNodes.length; i < l; i++) {
          this._childNodes[i]!.remove();
        }

        this._childNodes = [];
        this._memoizedContent = '';
      }
    }

    this._status = BindingStatus.Committed;
  }

  private _requestMutation(
    context: UpdateContext<unknown>,
    newStatus: BindingStatus,
  ): void {
    if (this._status === BindingStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
    this._status = newStatus;
  }
}
