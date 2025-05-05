import type {
  Binding,
  Effect,
  EffectProtocol,
  Template,
  TemplateInstance,
  UpdateProtocol,
} from './coreTypes.js';
import type { ChildNodePart } from './part.js';

enum TemplateStatus {
  Idle,
  Dirty,
  Mouting,
  Unmouting,
}

export class TemplateBinding<TBinds> implements Binding<TBinds>, Effect {
  private readonly _template: Template<TBinds>;

  private _binds: TBinds;

  private readonly _part: ChildNodePart;

  private _templateInstance: TemplateInstance<TBinds> | null = null;

  private _status: TemplateStatus = TemplateStatus.Idle;

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

  connect(context: UpdateProtocol): void {
    if (this._templateInstance !== null) {
      this._templateInstance.connect(context);
      this._status = TemplateStatus.Dirty;
    } else {
      this._templateInstance = context.renderTemplate(
        this._template,
        this._binds,
      );
      this._templateInstance.connect(context);
      this._status = TemplateStatus.Mouting;
    }
  }

  bind(binds: TBinds, context: UpdateProtocol): void {
    if (this._templateInstance !== null) {
      this._templateInstance.bind(binds, context);
      this._status = TemplateStatus.Dirty;
    } else {
      this._templateInstance = context.renderTemplate(
        this._template,
        this._binds,
      );
      this._templateInstance.connect(context);
      this._status = TemplateStatus.Mouting;
    }
    this._binds = binds;
  }

  unbind(context: UpdateProtocol): void {
    if (this._templateInstance !== null) {
      this._templateInstance.unbind(context);
      this._status = TemplateStatus.Unmouting;
    } else {
      this._status = TemplateStatus.Idle;
    }
  }

  disconnect(context: UpdateProtocol): void {
    this._templateInstance?.disconnect(context);
    this._status = TemplateStatus.Idle;
  }

  commit(context: EffectProtocol): void {
    switch (this._status) {
      case TemplateStatus.Mouting: {
        if (this._templateInstance !== null) {
          this._templateInstance.mount(this._part);
          this._templateInstance.commit(context);
        }
        break;
      }
      case TemplateStatus.Unmouting: {
        if (this._templateInstance !== null) {
          this._templateInstance.commit(context);
          this._templateInstance.unmount(this._part);
          this._templateInstance = null;
        }
        break;
      }
      case TemplateStatus.Dirty: {
        this._templateInstance?.commit(context);
        break;
      }
    }
    this._status = TemplateStatus.Idle;
  }
}
