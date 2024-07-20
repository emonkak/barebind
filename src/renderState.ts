import { RenderContext } from './renderContext.js';
import { TaggedTemplate, getMarker } from './template/taggedTemplate.js';
import type {
  Block,
  Component,
  Effect,
  EffectPhase,
  Hook,
  TemplateResult,
  UpdateContext,
  Updater,
} from './types.js';

type Namespace = Map<unknown, unknown>;

export class RenderState implements UpdateContext<RenderContext> {
  private readonly _marker: string = getMarker();

  private readonly _defaultNamespace: Namespace;

  private readonly _blockNamespaces: WeakMap<Block<RenderContext>, Namespace> =
    new WeakMap();

  private readonly _cachedTemplates: WeakMap<
    ReadonlyArray<string>,
    TaggedTemplate
  > = new WeakMap();

  constructor(defaultValues: Iterable<[unknown, unknown]> = []) {
    this._defaultNamespace = new Map(defaultValues);
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
      const value = this._blockNamespaces.get(current)?.get(key);
      if (value !== undefined) {
        return value;
      }
    } while ((current = current.parent));
    return this._defaultNamespace.get(key);
  }

  renderComponent<TProps, TData>(
    component: Component<TProps, TData, RenderContext>,
    props: TProps,
    hooks: Hook[],
    block: Block<RenderContext>,
    updater: Updater<RenderContext>,
  ): TemplateResult<TData, RenderContext> {
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
    const variables = this._blockNamespaces.get(block);
    if (variables !== undefined) {
      variables.set(key, value);
    } else {
      const namespace = new Map();
      namespace.set(key, value);
      this._blockNamespaces.set(block, namespace);
    }
  }
}
