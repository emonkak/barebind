import type {
  ChildNodePart,
  Template,
  TemplateView,
  UpdateContext,
} from '../baseTypes.js';

export class UnsafeHTMLTemplate implements Template<null> {
  private _content: string;

  constructor(content: string) {
    this._content = content;
  }

  get content(): string {
    return this._content;
  }

  render(
    _data: null,
    _context: UpdateContext<unknown>,
  ): UnsafeContentTemplateView {
    const template = document.createElement('template');
    template.innerHTML = this._content;
    return new UnsafeContentTemplateView([...template.content.childNodes]);
  }

  isSameTemplate(other: Template<null>): boolean {
    return (
      other === this ||
      (other instanceof UnsafeHTMLTemplate && this._content === other._content)
    );
  }
}

export class UnsafeSVGTemplate implements Template<null> {
  private _content: string;

  constructor(content: string) {
    this._content = content;
  }

  get content(): string {
    return this._content;
  }

  render(
    _data: null,
    _context: UpdateContext<unknown>,
  ): UnsafeContentTemplateView {
    const template = document.createElement('template');
    template.innerHTML = '<svg>' + this._content + '</svg>';
    return new UnsafeContentTemplateView([
      ...template.content.firstChild!.childNodes,
    ]);
  }

  isSameTemplate(other: Template<null>): boolean {
    return (
      other === this ||
      (other instanceof UnsafeSVGTemplate && this._content === other._content)
    );
  }
}

export class UnsafeContentTemplateView implements TemplateView<null> {
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

  connect(_context: UpdateContext<unknown>): void {}

  bind(_data: null, _context: UpdateContext<unknown>): void {}

  unbind(_context: UpdateContext<unknown>): void {}

  disconnect(): void {}

  mount(part: ChildNodePart): void {
    part.node.before(...this._childNodes);
  }

  unmount(_part: ChildNodePart): void {
    for (let i = 0, l = this._childNodes.length; i < l; i++) {
      this._childNodes[i]!.remove();
    }
  }
}
