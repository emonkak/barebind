import type {
  ChildNodePart,
  DirectiveContext,
  Template,
  TemplateView,
  UpdateContext,
} from '../baseTypes.js';

export class EmptyTemplate implements Template<null> {
  static readonly instance = new EmptyTemplate();

  private constructor() {
    if (EmptyTemplate.instance !== undefined) {
      throw new Error('EmptyTemplate constructor cannot be called directly.');
    }
  }

  render(_data: null, _context: DirectiveContext): EmptyTemplateView {
    return new EmptyTemplateView();
  }

  isSameTemplate(other: Template<null>): boolean {
    return other === this;
  }
}

export class EmptyTemplateView implements TemplateView<null> {
  get startNode(): null {
    return null;
  }

  get endNode(): null {
    return null;
  }

  connect(_context: UpdateContext): void {}

  bind(_data: null, _context: UpdateContext): void {}

  unbind(_context: UpdateContext): void {}

  mount(_part: ChildNodePart): void {}

  unmount(_part: ChildNodePart): void {}

  disconnect(_context: UpdateContext): void {}
}
