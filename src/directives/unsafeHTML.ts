import {
  type Binding,
  type Directive,
  directiveTag,
  ensureDirective,
} from '../binding.js';
import {
  type ChildNodePart,
  type Part,
  PartType,
  type Updater,
} from '../types.js';

export function unsafeHTML(content: string): UnsafeHTMLDirective {
  return new UnsafeHTMLDirective(content);
}

export class UnsafeHTMLDirective implements Directive {
  private readonly _unsafeContent: string;

  constructor(unsafeContent: string) {
    this._unsafeContent = unsafeContent;
  }

  get unsafeContent(): string {
    return this._unsafeContent;
  }

  [directiveTag](part: Part, _updater: Updater): UnsafeHTMLBinding {
    if (part.type !== PartType.ChildNode) {
      throw new Error('UnsafeHTMLDirective must be used in ChildNodePart.');
    }
    return new UnsafeHTMLBinding(this, part);
  }
}

export class UnsafeHTMLBinding implements Binding<UnsafeHTMLDirective> {
  private _directive: UnsafeHTMLDirective;

  private readonly _part: ChildNodePart;

  private _childNodes: ChildNode[] = [];

  private _dirty = false;

  constructor(_value: UnsafeHTMLDirective, part: ChildNodePart) {
    this._directive = _value;
    this._part = part;
  }

  get value(): UnsafeHTMLDirective {
    return this._directive;
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

  connect(updater: Updater): void {
    this._requestMutation(updater);
  }

  bind(newValue: UnsafeHTMLDirective, updater: Updater): void {
    DEBUG: {
      ensureDirective(UnsafeHTMLDirective, newValue);
    }
    const oldValue = this._directive;
    if (oldValue.unsafeContent !== newValue.unsafeContent) {
      this._directive = newValue;
      this._requestMutation(updater);
    }
  }

  unbind(updater: Updater): void {
    const { unsafeContent } = this._directive;
    if (unsafeContent !== '') {
      this._directive = new UnsafeHTMLDirective('');
      this.connect(updater);
    }
  }

  disconnect(): void {}

  commit(): void {
    const { unsafeContent } = this._directive;

    for (let i = 0, l = this._childNodes.length; i < l; i++) {
      this._childNodes[i]!.remove();
    }

    if (unsafeContent !== '') {
      const template = document.createElement('template');
      const reference = this._part.node;

      template.innerHTML = unsafeContent;
      this._childNodes = [...template.content.childNodes];
      reference.before(template.content);
    } else {
      this._childNodes = [];
    }

    this._dirty = false;
  }

  private _requestMutation(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }
}
