import type {
  ChildNodePart,
  DirectiveContext,
  Template,
  TemplateResult,
  TemplateView,
  UpdateContext,
} from '../baseTypes.js';
import { LazyTemplateResult } from '../directives/templateResult.js';

export class UnsafeHTMLTemplate implements Template<readonly []> {
  private _content: string;

  constructor(content: string) {
    this._content = content;
  }

  get content(): string {
    return this._content;
  }

  render(_data: readonly [], _context: DirectiveContext): UnsafeTemplateView {
    const template = document.createElement('template');
    template.innerHTML = this._content;
    return new UnsafeTemplateView([...template.content.childNodes]);
  }

  isSameTemplate(other: Template<unknown>): boolean {
    return (
      other === this ||
      (other instanceof UnsafeHTMLTemplate && other._content === this._content)
    );
  }

  wrapInResult(data: readonly []): TemplateResult<readonly []> {
    return new LazyTemplateResult(this, data);
  }
}

export class UnsafeSVGTemplate implements Template<readonly []> {
  private _content: string;

  constructor(content: string) {
    this._content = content;
  }

  get content(): string {
    return this._content;
  }

  render(_data: readonly [], _context: DirectiveContext): UnsafeTemplateView {
    const template = document.createElement('template');
    template.innerHTML = '<svg>' + this._content + '</svg>';
    return new UnsafeTemplateView([...template.content.firstChild!.childNodes]);
  }

  isSameTemplate(other: Template<unknown>): boolean {
    return (
      other === this ||
      (other instanceof UnsafeSVGTemplate && other._content === this._content)
    );
  }

  wrapInResult(data: readonly []): TemplateResult<readonly []> {
    return new LazyTemplateResult(this, data);
  }
}

export class UnsafeTemplateView implements TemplateView<readonly []> {
  private _childNodes: ChildNode[] = [];

  constructor(childNodes: ChildNode[]) {
    this._childNodes = childNodes;
  }

  get startNode(): ChildNode | null {
    return this._childNodes[0] ?? null;
  }

  get endNode(): ChildNode | null {
    return this._childNodes.at(-1) ?? null;
  }

  get childNodes(): ChildNode[] {
    return this._childNodes;
  }

  connect(_context: UpdateContext): void {}

  bind(_data: readonly [], _context: UpdateContext): void {}

  unbind(_context: UpdateContext): void {}

  disconnect(_context: UpdateContext): void {}

  mount(part: ChildNodePart): void {
    part.node.before(...this._childNodes);
  }

  unmount(_part: ChildNodePart): void {
    const childNodes = this._childNodes;
    for (let i = 0, l = childNodes.length; i < l; i++) {
      childNodes[i]!.remove();
    }
  }
}
