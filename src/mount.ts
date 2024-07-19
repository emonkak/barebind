import { resolveBinding } from './binding.js';
import {
  type Binding,
  type Effect,
  type Part,
  PartType,
  type Updater,
} from './types.js';

export function mount<TValue, TContext>(
  value: TValue,
  container: ChildNode,
  updater: Updater<TContext>,
): Binding<TValue> {
  const part = {
    type: PartType.ChildNode,
    node: document.createComment(''),
  } as const;

  updater.enqueueMutationEffect(new MountPart(part, container));

  const binding = resolveBinding(value, part, updater);

  binding.connect(updater);

  if (!updater.isScheduled()) {
    updater.scheduleUpdate();
  }

  return binding;
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
