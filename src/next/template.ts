import type {
  Binding,
  Effect,
  Template,
  TemplateBlock,
  UpdateContext,
} from './directive.js';
import type { Part } from './part.js';

export class TemplateBinding<TBinds, TPart extends Part>
  implements Binding<TBinds>, Effect
{
  private readonly _template: Template<TBinds, TPart>;

  private _binds: TBinds;

  private readonly _part: TPart;

  private _pendingBlock: TemplateBlock<TBinds, TPart> | null = null;

  private _memoizedBlock: TemplateBlock<TBinds, TPart> | null = null;

  private _dirty = true;

  constructor(template: Template<TBinds, TPart>, binds: TBinds, part: TPart) {
    this._template = template;
    this._binds = binds;
    this._part = part;
  }

  get directive(): Template<TBinds, TPart> {
    return this._template;
  }

  get value(): TBinds {
    return this._binds;
  }

  get part(): TPart {
    return this._part;
  }

  bind(binds: TBinds, _context: UpdateContext): void {
    this._dirty ||= binds !== this._binds;
    this._binds = binds;
  }

  connect(context: UpdateContext): void {
    if (!this._dirty) {
      return;
    }
    if (this._pendingBlock !== null) {
      this._pendingBlock.bind(this._binds, context);
    } else {
      this._pendingBlock = context.renderTemplate(this._template, this._binds);
    }
    this._pendingBlock.connect(context);
  }

  disconnect(context: UpdateContext): void {
    this._pendingBlock?.disconnect(context);
    this._dirty = true;
  }

  commit(): void {
    if (!this._dirty) {
      return;
    }
    if (this._pendingBlock !== null) {
      if (this._memoizedBlock === null) {
        this._pendingBlock.mount(this._part);
      }
      this._pendingBlock.commit();
    }
    this._memoizedBlock = this._pendingBlock;
    this._dirty = false;
  }

  rollback(): void {
    if (!this._dirty) {
      return;
    }
    if (this._memoizedBlock !== null) {
      this._memoizedBlock.unmount(this._part);
      this._memoizedBlock.rollback();
    }
    this._memoizedBlock = null;
    this._dirty = false;
  }
}
