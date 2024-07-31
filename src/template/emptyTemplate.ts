import type {
  ChildNodePart,
  Template,
  TemplateFragment,
  UpdateContext,
} from '../types.js';

export class EmptyTemplate implements Template<null> {
  static readonly instance: EmptyTemplate = new EmptyTemplate();

  private constructor() {
    if (EmptyTemplate.instance !== undefined) {
      throw new Error('EmptyTemplate constructor cannot be called directly.');
    }
  }

  render(_data: null, _context: UpdateContext<unknown>): EmptyTemplateFragment {
    return new EmptyTemplateFragment();
  }

  isSameTemplate(other: Template<null>): boolean {
    return other === this;
  }
}

export class EmptyTemplateFragment implements TemplateFragment<null> {
  get startNode(): null {
    return null;
  }

  get endNode(): null {
    return null;
  }

  connect(_context: UpdateContext<unknown>): void {}

  bind(_data: null, _context: UpdateContext<unknown>): void {}

  unbind(_context: UpdateContext<unknown>): void {}

  mount(_part: ChildNodePart): void {}

  unmount(_part: ChildNodePart): void {}

  disconnect(): void {}
}
