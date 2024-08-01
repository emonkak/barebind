import { resolveBinding } from './binding.js';
import { RenderContext } from './renderContext.js';
import { TaggedTemplate, getMarker } from './template/taggedTemplate.js';
import {
  type Binding,
  type Block,
  type Effect,
  type EffectPhase,
  type Hook,
  type Part,
  PartType,
  type TaskPriority,
  type UpdateHost,
  type Updater,
  createUpdateContext,
  nameOf,
} from './types.js';

export interface UpdateControllerOptions {
  constants?: Map<unknown, unknown>;
}

export class UpdateController implements UpdateHost<RenderContext> {
  private readonly _constants: Map<unknown, unknown>;

  private readonly _blockScopes: WeakMap<
    Block<RenderContext>,
    Map<unknown, unknown>
  > = new WeakMap();

  private readonly _cachedTemplates: WeakMap<
    ReadonlyArray<string>,
    TaggedTemplate<readonly any[]>
  > = new WeakMap();

  private readonly _marker: string = getMarker();

  constructor({ constants = new Map() }: UpdateControllerOptions = {}) {
    this._constants = new Map(constants);
  }

  beginRender(
    hooks: Hook[],
    block: Block<RenderContext>,
    updater: Updater<RenderContext>,
  ): RenderContext {
    return new RenderContext(hooks, block, this, updater);
  }

  finishRender(context: RenderContext): void {
    context.finalize();
  }

  flushEffects(effects: Effect[], phase: EffectPhase): void {
    for (let i = 0, l = effects.length; i < l; i++) {
      effects[i]!.commit(phase);
    }
  }

  getCurrentPriority(): TaskPriority {
    const currentEvent = window.event;
    if (currentEvent !== undefined) {
      return isContinuousEvent(currentEvent) ? 'user-visible' : 'user-blocking';
    } else {
      return 'user-visible';
    }
  }

  getHTMLTemplate<TData extends readonly any[]>(
    tokens: ReadonlyArray<string>,
    data: TData,
  ): TaggedTemplate<TData> {
    let template = this._cachedTemplates.get(tokens);

    if (template === undefined) {
      template = TaggedTemplate.parseHTML(tokens, data, this._marker);
      this._cachedTemplates.set(tokens, template);
    }

    return template;
  }

  getSVGTemplate<TData extends readonly any[]>(
    tokens: ReadonlyArray<string>,
    data: TData,
  ): TaggedTemplate<TData> {
    let template = this._cachedTemplates.get(tokens);

    if (template === undefined) {
      template = TaggedTemplate.parseSVG(tokens, data, this._marker);
      this._cachedTemplates.set(tokens, template);
    }

    return template;
  }

  getScopedValue(
    key: unknown,
    block: Block<RenderContext> | null = null,
  ): unknown {
    let currentScope = block;
    while (currentScope !== null) {
      const value = this._blockScopes.get(currentScope)?.get(key);
      if (value !== undefined) {
        return value;
      }
      currentScope = currentScope.parent;
    }
    return this._constants.get(key);
  }

  mount<TValue>(
    value: TValue,
    container: ChildNode,
    updater: Updater<RenderContext>,
  ): Binding<TValue, RenderContext> {
    const part = {
      type: PartType.ChildNode,
      node: document.createComment(''),
    } as const;

    DEBUG: {
      part.node.data = nameOf(value);
    }

    updater.enqueueMutationEffect(new MountPart(part, container));

    const context = createUpdateContext(this, updater);
    const binding = resolveBinding(value, part, context);

    binding.connect(context);

    updater.scheduleUpdate(this);

    return binding;
  }

  setScopedValue(
    key: unknown,
    value: unknown,
    block: Block<RenderContext>,
  ): void {
    const variables = this._blockScopes.get(block);
    if (variables !== undefined) {
      variables.set(key, value);
    } else {
      const namespace = new Map();
      namespace.set(key, value);
      this._blockScopes.set(block, namespace);
    }
  }
}

function isContinuousEvent(event: Event): boolean {
  switch (event.type as keyof DocumentEventMap) {
    case 'drag':
    case 'dragenter':
    case 'dragleave':
    case 'dragover':
    case 'mouseenter':
    case 'mouseleave':
    case 'mousemove':
    case 'mouseout':
    case 'mouseover':
    case 'pointerenter':
    case 'pointerleave':
    case 'pointermove':
    case 'pointerout':
    case 'pointerover':
    case 'scroll':
    case 'touchmove':
    case 'wheel':
      return true;
    default:
      return false;
  }
}

class MountPart implements Effect {
  private readonly _part: Part;

  private readonly _container: ChildNode;

  constructor(part: Part, container: ChildNode) {
    this._part = part;
    this._container = container;
  }

  commit(): void {
    this._container.appendChild(this._part.node);
  }
}
