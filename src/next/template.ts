import type {
  Binding,
  Effect,
  Template,
  TemplateBlock,
  UpdateContext,
} from './coreTypes.js';
import type { Part } from './part.js';

export class TemplateBinding<TBinds, TPart extends Part>
  implements Binding<TBinds>, Effect
{
  private readonly _template: Template<TBinds, TPart>;

  private _pendingBinds: TBinds;

  private _memoizedBinds: TBinds | null = null;

  private readonly _part: TPart;

  private _pendingBlock: TemplateBlock<TBinds, TPart> | null = null;

  private _memoizedBlock: TemplateBlock<TBinds, TPart> | null = null;

  private _dirty = false;

  constructor(template: Template<TBinds, TPart>, binds: TBinds, part: TPart) {
    this._template = template;
    this._pendingBinds = binds;
    this._part = part;
  }

  get directive(): Template<TBinds, TPart> {
    return this._template;
  }

  get part(): TPart {
    return this._part;
  }

  get value(): TBinds {
    return this._pendingBinds;
  }

  connect(context: UpdateContext): void {
    if (this._pendingBlock !== null) {
      this._pendingBlock.connect(context);
    } else {
      this._pendingBlock = context.renderTemplate(
        this._template,
        this._pendingBinds,
      );
      this._pendingBlock.connect(context);
    }
    this._dirty = true;
  }

  bind(binds: TBinds, context: UpdateContext): void {
    if (this._pendingBlock !== null) {
      const dirty = binds !== this._memoizedBinds;
      if (dirty) {
        this._pendingBlock.bind(binds, context);
      }
      this._dirty ||= dirty;
    } else {
      this._pendingBlock = context.renderTemplate(
        this._template,
        this._pendingBinds,
      );
      this._pendingBlock.connect(context);
      this._dirty = true;
    }
    this._pendingBinds = binds;
  }

  disconnect(context: UpdateContext): void {
    this._memoizedBlock?.disconnect(context);
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
    this._memoizedBinds = this._pendingBinds;
    this._dirty = false;
  }

  rollback(): void {
    if (this._memoizedBlock !== null) {
      this._memoizedBlock.unmount(this._part);
      this._memoizedBlock.rollback();
    }
    this._memoizedBlock = null;
    this._memoizedBinds = null;
    this._dirty = false;
  }
}
