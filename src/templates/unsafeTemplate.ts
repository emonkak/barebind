import type {
  ChildNodePart,
  DirectiveContext,
  Template,
  TemplateMode,
  TemplateResult,
  TemplateView,
  UpdateContext,
} from '../baseTypes.js';
import { LazyTemplateResult } from '../directives/templateResult.js';

export class UnsafeTemplate implements Template<readonly []> {
  private _content: string;

  private _mode: TemplateMode;

  constructor(content: string, mode: TemplateMode) {
    this._content = content;
    this._mode = mode;
  }

  get content(): string {
    return this._content;
  }

  get mode(): TemplateMode {
    return this._mode;
  }

  render(_data: readonly [], _context: DirectiveContext): UnsafeTemplateView {
    const template = document.createElement('template');
    if (this._mode === 'math' || this._mode === 'svg') {
      const template = document.createElement('template');
      template.innerHTML =
        '<' + this._mode + '>' + this._content + '</' + this._mode + '>';
      return new UnsafeTemplateView([
        ...template.content.firstChild!.childNodes,
      ]);
    } else {
      template.innerHTML = this._content;
      return new UnsafeTemplateView([...template.content.childNodes]);
    }
  }

  isSameTemplate(other: Template<unknown>): boolean {
    return (
      other === this ||
      (other instanceof UnsafeTemplate &&
        other._content === this._content &&
        other._mode === this._mode)
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
