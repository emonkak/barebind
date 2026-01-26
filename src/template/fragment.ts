import { sequentialEqual } from '../compare.js';
import {
  areDirectiveTypesEqual,
  type Part,
  type Template,
  type TemplateResult,
  type UpdateSession,
} from '../internal.js';
import { AbstractTemplate } from './template.js';

export class FragmentTemplate extends AbstractTemplate<readonly unknown[]> {
  private readonly _templates: readonly Template<readonly unknown[]>[];

  constructor(templates: readonly Template<readonly unknown[]>[]) {
    super();
    this._templates = templates;
  }

  get arity(): number {
    return this._templates.reduce(
      (arity, template) => arity + template.arity,
      0,
    );
  }

  equals(other: unknown): boolean {
    return (
      other instanceof FragmentTemplate &&
      sequentialEqual(other._templates, this._templates, areDirectiveTypesEqual)
    );
  }

  hydrate(
    binds: readonly unknown[],
    part: Part.ChildNodePart,
    targetTree: TreeWalker,
    session: UpdateSession,
  ): TemplateResult {
    const children = [];
    const slots = [];
    let offset = 0;

    for (const template of this._templates) {
      const result = template.hydrate(
        binds.slice(offset, offset + template.arity),
        part,
        targetTree,
        session,
      );
      children.push(...result.children);
      slots.push(...result.slots);
      offset += template.arity;
    }

    return { children, slots };
  }

  render(
    binds: readonly unknown[],
    part: Part.ChildNodePart,
    session: UpdateSession,
  ): TemplateResult {
    const children = [];
    const slots = [];
    let offset = 0;

    for (const template of this._templates) {
      const result = template.render(
        binds.slice(offset, offset + template.arity),
        part,
        session,
      );
      children.push(...result.children);
      slots.push(...result.slots);
      offset += template.arity;
    }

    return { children, slots };
  }
}
