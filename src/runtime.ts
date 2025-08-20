import type {
  CommitPhase,
  Component,
  Effect,
  Lanes,
  Part,
  Primitive,
  RenderContext,
  RequestCallbackOptions,
  SlotType,
  Template,
  TemplateFactory,
  UpdateHandle,
} from './internal.js';
import { LinkedList } from './linked-list.js';
import { TemplateLiteralPreprocessor } from './template-literal.js';

export interface Runtime {
  backend: RuntimeBackend;
  cachedTemplates: WeakMap<readonly string[], Template<readonly unknown[]>>;
  concurrent: boolean;
  identifierCount: number;
  observers: LinkedList<RuntimeObserver>;
  templateLiteralPreprocessor: TemplateLiteralPreprocessor;
  templatePlaceholder: string;
  updateCount: number;
  updateHandles: LinkedList<UpdateHandle>;
}

export interface RuntimeBackend {
  commitEffects(effects: Effect[], phase: CommitPhase): void;
  getCurrentPriority(): TaskPriority;
  getTemplateFactory(): TemplateFactory;
  requestCallback(
    callback: () => Promise<void> | void,
    options?: RequestCallbackOptions,
  ): Promise<void>;
  resolvePrimitive(value: unknown, part: Part): Primitive<unknown>;
  resolveSlotType(value: unknown, part: Part): SlotType;
  startViewTransition(callback: () => void | Promise<void>): Promise<void>;
  yieldToMain(): Promise<void>;
}

export type RuntimeEvent =
  | {
      type: 'UPDATE_START' | 'UPDATE_END';
      id: number;
      lanes: Lanes;
    }
  | {
      type: 'RENDER_START' | 'RENDER_END';
      id: number;
    }
  | {
      type: 'COMMIT_START' | 'COMMIT_END';
      id: number;
      effects: Effect[];
      phase: CommitPhase;
    }
  | {
      type: 'COMPONENT_RENDER_START' | 'COMPONENT_RENDER_END';
      id: number;
      component: Component<any>;
      props: unknown;
      context: RenderContext;
    };

export interface RuntimeObserver {
  onRuntimeEvent(event: RuntimeEvent): void;
}

export interface RuntimeOptions {
  concurrent?: boolean;
}

export function createRuntime(
  backend: RuntimeBackend,
  options: RuntimeOptions = {},
): Runtime {
  return {
    backend,
    cachedTemplates: new WeakMap(),
    concurrent: options.concurrent ?? false,
    identifierCount: 0,
    observers: new LinkedList(),
    templateLiteralPreprocessor: new TemplateLiteralPreprocessor(),
    templatePlaceholder: generateRandomString(8),
    updateCount: 1,
    updateHandles: new LinkedList(),
  };
}

function generateRandomString(length: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) =>
    (byte % 36).toString(36),
  ).join('');
}
