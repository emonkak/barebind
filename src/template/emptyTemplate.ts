import type {
  ChildNodePart,
  Template,
  TemplateFragment,
  Updater,
} from '../types.js';

export class EmptyTemplate implements Template<null> {
  static readonly instance: EmptyTemplate = new EmptyTemplate();

  private constructor() {
    if (EmptyTemplate.instance !== undefined) {
      throw new Error('EmptyTemplate constructor cannot be called directly.');
    }
  }

  render(_data: null, _updater: Updater): EmptyTemplateFragment {
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

  bind(_data: null, _updater: Updater<unknown>): void {}

  unbind(_updater: Updater): void {}

  mount(_part: ChildNodePart): void {}

  unmount(_part: ChildNodePart): void {}

  disconnect(): void {}
}
