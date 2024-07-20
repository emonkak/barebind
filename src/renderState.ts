import { RenderContext } from './renderContext.js';
import { TaggedTemplate, getMarker } from './template/taggedTemplate.js';
import type {
  Block,
  ComponentFunction,
  Effect,
  EffectPhase,
  Hook,
  TemplateResultInterface,
  UpdateContext,
  Updater,
} from './types.js';

type Scope = Map<unknown, unknown>;

export class RenderState implements UpdateContext<RenderContext> {
  private readonly _rootScope: Scope;

  private readonly _blockScopes: WeakMap<Block<RenderContext>, Scope> =
    new WeakMap();

  private readonly _cachedTemplates: WeakMap<
    ReadonlyArray<string>,
    TaggedTemplate
  > = new WeakMap();

  private readonly _marker: string = getMarker();

  constructor(constants: Iterable<[unknown, unknown]> = []) {
    this._rootScope = new Map(constants);
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

  getScopedValue(block: Block<RenderContext>, key: unknown): unknown {
    let current: Block<RenderContext> | null = block;
    do {
      const value = this._blockScopes.get(current)?.get(key);
      if (value !== undefined) {
        return value;
      }
    } while ((current = current.parent));
    return this._rootScope.get(key);
  }

  renderComponent<TProps, TData>(
    component: ComponentFunction<TProps, TData, RenderContext>,
    props: TProps,
    hooks: Hook[],
    block: Block<RenderContext>,
    updater: Updater<RenderContext>,
  ): TemplateResultInterface<TData, RenderContext> {
    const context = new RenderContext(hooks, block, this, updater);
    const result = component(props, context);
    context.finalize();
    return result;
  }

  setScopedValue(
    block: Block<RenderContext>,
    key: unknown,
    value: unknown,
  ): void {
    const variables = this._blockScopes.get(block);
    if (variables !== undefined) {
      variables.set(key, value);
    } else {
      const scope = new Map();
      scope.set(key, value);
      this._blockScopes.set(block, scope);
    }
  }
}
