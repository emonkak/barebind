import {
  type Effect,
  PartType,
  type RenderHost,
  UpdateContext,
  type Updater,
  nameOf,
  resolveBinding,
} from './baseTypes.js';
import { BlockBinding } from './bindings/block.js';

export interface Root<T> {
  mount(): void;
  unmount(): void;
  update(value: T): void;
}

export function createRoot<TValue, TContext>(
  value: TValue,
  container: Node,
  host: RenderHost<TContext>,
  updater: Updater<TContext>,
): Root<TValue> {
  const part = {
    type: PartType.ChildNode,
    node: document.createComment(''),
  } as const;

  DEBUG: {
    part.node.data = nameOf(value);
  }

  const binding = resolveBinding(value, part, { host, block: null });
  const block = BlockBinding.ofRoot(binding);
  const context = new UpdateContext<TContext>(host, updater, block);

  return {
    mount(): void {
      context.enqueueMutationEffect(new MountNode(part.node, container));
      binding.connect(context);
      context.scheduleUpdate();
    },
    unmount(): void {
      binding.unbind(context);
      context.enqueueMutationEffect(new UnmountNode(part.node, container));
      context.scheduleUpdate();
    },
    update(newValue: TValue): void {
      binding.bind(newValue, context);
      context.scheduleUpdate();
    },
  };
}

class MountNode implements Effect {
  private readonly _node: Node;

  private readonly _container: Node;

  constructor(node: Node, container: Node) {
    this._node = node;
    this._container = container;
  }

  commit(): void {
    this._container.appendChild(this._node);
  }
}

class UnmountNode implements Effect {
  private readonly _node: Node;

  private readonly _container: Node;

  constructor(node: Node, container: Node) {
    this._node = node;
    this._container = container;
  }

  commit(): void {
    this._container.removeChild(this._node);
  }
}
