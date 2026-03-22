import { sequentialEqual } from '../compare.js';
import {
  areDirectiveTypesEqual,
  type Part,
  type UpdateSession,
} from '../core.js';
import { Template, type TemplateResult } from './template.js';

export class FragmentTemplate extends Template<readonly unknown[]> {
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
    values: readonly unknown[],
    part: Part.ChildNodePart,
    hydrationTarget: TreeWalker,
    session: UpdateSession,
  ): TemplateResult {
    const childNodes = [];
    const slots = [];
    let offset = 0;

    for (const template of this._templates) {
      const { arity } = template;
      const result = template.hydrate(
        values.slice(offset, offset + arity),
        part,
        hydrationTarget,
        session,
      );
      childNodes.push(...result.childNodes);
      slots.push(...result.slots);
      offset += arity;
    }

    return { childNodes, slots };
  }

  render(
    values: readonly unknown[],
    part: Part.ChildNodePart,
    session: UpdateSession,
  ): TemplateResult {
    const childNodes = [];
    const slots = [];
    let offset = 0;

    for (const template of this._templates) {
      const { arity } = template;
      const result = template.render(
        values.slice(offset, offset + arity),
        part,
        session,
      );
      childNodes.push(...result.childNodes);
      slots.push(...result.slots);
      offset += arity;
    }

    return { childNodes, slots };
  }
}
