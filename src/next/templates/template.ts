import type {
  Binding,
  Effect,
  Template,
  TemplateBlock,
  UpdateContext,
} from '../core.js';
import type { ChildNodePart } from '../part.js';

export class TemplateBinding<TBinds> implements Binding<TBinds>, Effect {
  private readonly _template: Template<TBinds>;

  private _binds: TBinds;

  private readonly _part: ChildNodePart;

  private _pendingBlock: TemplateBlock<TBinds> | null = null;

  private _memoizedBlock: TemplateBlock<TBinds> | null = null;

  constructor(template: Template<TBinds>, binds: TBinds, part: ChildNodePart) {
    this._template = template;
    this._binds = binds;
    this._part = part;
  }

  get directive(): Template<TBinds> {
    return this._template;
  }

  get value(): TBinds {
    return this._binds;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  shouldBind(binds: TBinds): boolean {
    return this._memoizedBlock === null || binds !== this._binds;
  }

  bind(binds: TBinds): void {
    this._binds = binds;
  }

  connect(context: UpdateContext): void {
    if (this._pendingBlock !== null) {
      this._pendingBlock.reconcile(this._binds, context);
    } else {
      this._pendingBlock = context.renderTemplate(this._template, this._binds);
      this._pendingBlock.connect(context);
    }
  }

  disconnect(context: UpdateContext): void {
    this._pendingBlock?.disconnect(context);
  }

  commit(): void {
    if (this._pendingBlock !== null) {
      if (this._memoizedBlock === null) {
        this._pendingBlock.mount(this._part);
      }
      this._pendingBlock.commit();
    }
    this._memoizedBlock = this._pendingBlock;
  }

  rollback(): void {
    if (this._memoizedBlock !== null) {
      this._memoizedBlock.unmount(this._part);
      this._memoizedBlock.rollback();
    }
    this._memoizedBlock = null;
  }
}
