import type {
  Binding,
  Effect,
  EffectContext,
  Template,
  TemplateInstance,
  UpdateContext,
} from './coreTypes.js';
import type { Part } from './part.js';

const enum TemplateStatus {
  Idle,
  Mouting,
  Unmouting,
}

export class TemplateBinding<TBinds, TPart extends Part>
  implements Binding<TBinds>, Effect
{
  private readonly _template: Template<TBinds, TPart>;

  private _pendingBinds: TBinds;

  private _memoizedBinds: TBinds | null = null;

  private readonly _part: TPart;

  private _pendingInstance: TemplateInstance<TBinds, TPart> | null = null;

  private _memoizedInstance: TemplateInstance<TBinds, TPart> | null = null;

  private _status: TemplateStatus = TemplateStatus.Idle;

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
    if (this._pendingInstance !== null) {
      this._pendingInstance.connect(context);
    } else {
      this._pendingInstance = context.renderTemplate(
        this._template,
        this._pendingBinds,
      );
      this._pendingInstance.connect(context);
    }
    this._status = TemplateStatus.Mouting;
  }

  bind(binds: TBinds, context: UpdateContext): void {
    if (this._pendingInstance !== null) {
      if (binds !== this._memoizedBinds) {
        this._pendingInstance.bind(binds, context);
        this._status = TemplateStatus.Mouting;
      } else {
        this._status = TemplateStatus.Idle;
      }
    } else {
      this._pendingInstance = context.renderTemplate(
        this._template,
        this._pendingBinds,
      );
      this._pendingInstance.connect(context);
      this._status = TemplateStatus.Mouting;
    }
    this._pendingBinds = binds;
  }

  unbind(context: UpdateContext): void {
    if (this._memoizedInstance !== null) {
      this._memoizedInstance.unbind(context);
      this._status = TemplateStatus.Unmouting;
    } else {
      this._status = TemplateStatus.Idle;
    }
  }

  disconnect(context: UpdateContext): void {
    this._memoizedInstance?.disconnect(context);
    this._status = TemplateStatus.Idle;
  }

  commit(context: EffectContext): void {
    switch (this._status) {
      case TemplateStatus.Mouting: {
        if (this._pendingInstance !== null) {
          if (this._memoizedInstance === null) {
            this._pendingInstance.mount(this._part);
          }
          this._pendingInstance.commit(context);
        }
        this._memoizedInstance = this._pendingInstance;
        this._memoizedBinds = this._pendingBinds;
        break;
      }
      case TemplateStatus.Unmouting: {
        if (this._memoizedInstance !== null) {
          this._memoizedInstance.unmount(this._part);
          this._memoizedInstance.commit(context);
        }
        this._memoizedInstance = null;
        this._memoizedBinds = null;
        break;
      }
    }
    this._status = TemplateStatus.Idle;
  }
}
