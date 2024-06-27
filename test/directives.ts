import { type Binding, type Directive, directiveTag } from '../src/binding.js';
import type { Effect, Part, Updater } from '../src/types.js';

export function text(content: string): TextDirective {
  return new TextDirective(content);
}

export class TextDirective implements Directive {
  private _content: string | null;

  constructor(content: string | null) {
    this._content = content;
  }

  get content(): string | null {
    return this._content;
  }

  [directiveTag](part: Part, _updater: Updater<unknown>): TextBinding {
    return new TextBinding(this, part);
  }
}

export class TextBinding implements Binding<TextDirective>, Effect {
  private _directive: TextDirective;

  private readonly _part: Part;

  private _text: Text = document.createTextNode('');

  constructor(value: TextDirective, part: Part) {
    this._directive = value;
    this._part = part;
  }

  get value(): TextDirective {
    return this._directive;
  }

  get part(): Part {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._text.parentNode !== null ? this._text : this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  bind(newValue: TextDirective, updater: Updater): void {
    this._directive = newValue;
    updater.enqueueMutationEffect(this);
  }

  connect(updater: Updater): void {
    updater.enqueueMutationEffect(this);
  }

  unbind(updater: Updater): void {
    this._directive = new TextDirective(null);
    updater.enqueueMutationEffect(this);
  }

  disconnect(): void {}

  commit() {
    const { content } = this._directive;

    this._text.nodeValue = content;

    if (content !== null) {
      this._part.node.before(this._text);
    } else {
      this._text.remove();
    }
  }
}
