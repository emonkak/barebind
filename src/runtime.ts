import type {
  Backend,
  CommitPhase,
  Component,
  Effect,
  Lanes,
  RenderContext,
  Template,
  UpdateHandle,
} from './internal.js';
import { LinkedList } from './linked-list.js';
import { TemplateLiteralPreprocessor } from './template-literal.js';

export interface Runtime {
  backend: Backend;
  cachedTemplates: WeakMap<readonly string[], Template<readonly unknown[]>>;
  concurrent: boolean;
  identifierCount: number;
  observers: LinkedList<RuntimeObserver>;
  templateLiteralPreprocessor: TemplateLiteralPreprocessor;
  templatePlaceholder: string;
  updateCount: number;
  updateHandles: LinkedList<UpdateHandle>;
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
  backend: Backend,
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
