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
  Updating,
  Unmouting,
}

export class TemplateBinding<TBinds, TPart extends Part>
  implements Binding<TBinds>, Effect
{
  private readonly _template: Template<TBinds, TPart>;

  private _pendingBinds: TBinds;

  private _memoizedBinds: TBinds | null = null;

  private readonly _part: TPart;

  private _templateInstance: TemplateInstance<TBinds, TPart> | null = null;

  private _status: TemplateStatus = TemplateStatus.Idle;

  constructor(template: Template<TBinds, TPart>, binds: TBinds, part: TPart) {
    this._template = template;
    this._pendingBinds = binds;
    this._part = part;
  }

  get directive(): Template<TBinds, TPart> {
    return this._template;
  }

  get value(): TBinds {
    return this._pendingBinds;
  }

  get part(): TPart {
    return this._part;
  }

  connect(context: UpdateContext): void {
    if (this._templateInstance !== null) {
      this._templateInstance.connect(context);
      this._status = TemplateStatus.Updating;
    } else {
      this._templateInstance = context.renderTemplate(
        this._template,
        this._pendingBinds,
      );
      this._templateInstance.connect(context);
      this._status = TemplateStatus.Mouting;
    }
  }

  bind(binds: TBinds, context: UpdateContext): void {
    if (this._templateInstance !== null) {
      if (binds !== this._memoizedBinds) {
        this._templateInstance.bind(binds, context);
        this._status = TemplateStatus.Updating;
      } else {
        this._status = TemplateStatus.Idle;
      }
    } else {
      this._templateInstance = context.renderTemplate(
        this._template,
        this._pendingBinds,
      );
      this._templateInstance.connect(context);
      this._status = TemplateStatus.Mouting;
    }
    this._pendingBinds = binds;
  }

  unbind(context: UpdateContext): void {
    if (this._templateInstance !== null) {
      this._templateInstance.unbind(context);
      this._status = TemplateStatus.Unmouting;
    } else {
      this._status = TemplateStatus.Idle;
    }
  }

  disconnect(context: UpdateContext): void {
    this._templateInstance?.disconnect(context);
    this._status = TemplateStatus.Idle;
  }

  commit(context: EffectContext): void {
    switch (this._status) {
      case TemplateStatus.Mouting: {
        if (this._templateInstance !== null) {
          this._templateInstance.mount(this._part);
          this._templateInstance.commit(context);
        }
        this._memoizedBinds = this._pendingBinds;
        break;
      }
      case TemplateStatus.Updating: {
        this._templateInstance?.commit(context);
        this._memoizedBinds = this._pendingBinds;
        break;
      }
      case TemplateStatus.Unmouting: {
        if (this._templateInstance !== null) {
          this._templateInstance.unmount(this._part);
          this._templateInstance.commit(context);
          this._templateInstance = null;
          this._memoizedBinds = null;
        }
        break;
      }
    }
    this._status = TemplateStatus.Idle;
  }
}
