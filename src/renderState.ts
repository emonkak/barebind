import { RenderContext } from './renderContext.js';
import { TaggedTemplate, getMarker } from './template/taggedTemplate.js';
import type {
  ComponentFunction,
  Effect,
  EffectPhase,
  Hook,
  TemplateResultInterface,
  UnitOfWork,
  UpdateContext,
  Updater,
} from './types.js';

export class RenderState implements UpdateContext<RenderContext> {
  private readonly _globalNamespace: Map<unknown, unknown>;

  private readonly _localNamespaces: WeakMap<
    UnitOfWork<RenderContext>,
    Map<unknown, unknown>
  > = new WeakMap();

  private readonly _cachedTemplates: WeakMap<
    ReadonlyArray<string>,
    TaggedTemplate
  > = new WeakMap();

  private readonly _marker: string = getMarker();

  constructor(globalNamespace: Map<unknown, unknown> = new Map()) {
    this._globalNamespace = new Map(globalNamespace);
  }

  flushEffects(effects: Effect[], phase: EffectPhase): void {
    for (let i = 0, l = effects.length; i < l; i++) {
      effects[i]!.commit(phase);
    }
  }

  getHTMLTemplate(
    tokens: ReadonlyArray<string>,
    data: unknown[],
  ): TaggedTemplate {
    let template = this._cachedTemplates.get(tokens);

    if (template === undefined) {
      template = TaggedTemplate.parseHTML(tokens, data, this._marker);
      this._cachedTemplates.set(tokens, template);
    }

    return template;
  }

  getSVGTemplate(
    tokens: ReadonlyArray<string>,
    data: unknown[],
  ): TaggedTemplate {
    let template = this._cachedTemplates.get(tokens);

    if (template === undefined) {
      template = TaggedTemplate.parseSVG(tokens, data, this._marker);
      this._cachedTemplates.set(tokens, template);
    }

    return template;
  }

  getScopedValue(unitOfWork: UnitOfWork<RenderContext>, key: unknown): unknown {
    let scope: UnitOfWork<RenderContext> | null = unitOfWork;
    do {
      const value = this._localNamespaces.get(scope)?.get(key);
      if (value !== undefined) {
        return value;
      }
    } while ((scope = scope.parent));
    return this._globalNamespace.get(key);
  }

  renderComponent<TProps, TData>(
    component: ComponentFunction<TProps, TData, RenderContext>,
    props: TProps,
    hooks: Hook[],
    unitOfWork: UnitOfWork<RenderContext>,
    updater: Updater<RenderContext>,
  ): TemplateResultInterface<TData, RenderContext> {
    const context = new RenderContext(hooks, unitOfWork, this, updater);
    const result = component(props, context);
    context.finalize();
    return result;
  }

  setScopedValue(
    unitOfWork: UnitOfWork<RenderContext>,
    key: unknown,
    value: unknown,
  ): void {
    const variables = this._localNamespaces.get(unitOfWork);
    if (variables !== undefined) {
      variables.set(key, value);
    } else {
      const namespace = new Map();
      namespace.set(key, value);
      this._localNamespaces.set(unitOfWork, namespace);
    }
  }
}
