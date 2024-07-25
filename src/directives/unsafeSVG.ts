import {
  type Binding,
  type ChildNodePart,
  type Directive,
  type Part,
  PartType,
  type Updater,
  directiveTag,
  ensureDirective,
} from '../types.js';

export function unsafeSVG(content: string): UnsafeSVG {
  return new UnsafeSVG(content);
}

export class UnsafeSVG implements Directive {
  private readonly _content: string;

  constructor(content: string) {
    this._content = content;
  }

  get content(): string {
    return this._content;
  }

  [directiveTag](part: Part, _updater: Updater): UnsafeSVGBinding {
    if (part.type !== PartType.ChildNode) {
      throw new Error('UnsafeSVG directive must be used in ChildNodePart.');
    }
    return new UnsafeSVGBinding(this, part);
  }
}

export class UnsafeSVGBinding implements Binding<UnsafeSVG> {
  private _directive: UnsafeSVG;

  private readonly _part: ChildNodePart;

  private _childNodes: ChildNode[] = [];

  private _dirty = false;

  constructor(directive: UnsafeSVG, part: ChildNodePart) {
    this._directive = directive;
    this._part = part;
  }

  get value(): UnsafeSVG {
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

  bind(newValue: UnsafeSVG, updater: Updater): void {
    DEBUG: {
      ensureDirective(UnsafeSVG, newValue);
    }
    const oldValue = this._directive;
    if (oldValue.content !== newValue.content) {
      this._directive = newValue;
      this._requestMutation(updater);
    }
  }

  unbind(updater: Updater): void {
    const { content } = this._directive;
    if (content !== '') {
      this._directive = new UnsafeSVG('');
      this.connect(updater);
    }
  }

  disconnect(): void {}

  commit(): void {
    const { content } = this._directive;

    for (let i = 0, l = this._childNodes.length; i < l; i++) {
      this._childNodes[i]!.remove();
    }

    if (content !== '') {
      const template = document.createElement('template');
      const reference = this._part.node;

      template.innerHTML = '<svg>' + content + '</svg>';
      this._childNodes = [...template.content.firstChild!.childNodes];
      reference.before(...this._childNodes);
    } else {
      this._childNodes = [];
    }

    this._dirty = false;
  }

  private _requestMutation(updater: Updater): void {
    if (!this._dirty) {
      this._dirty = true;
      updater.enqueueMutationEffect(this);
    }
  }
}
