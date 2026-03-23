import { sequentialEqual } from '../compare.js';
import { areDirectiveTypesEqual, type Part, type Session } from '../core.js';
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
    exprs: readonly unknown[],
    part: Part.ChildNodePart,
    hydrationTarget: TreeWalker,
    session: Session,
  ): TemplateResult {
    const childNodes = [];
    const slots = [];
    let offset = 0;

    for (const template of this._templates) {
      const { arity } = template;
      const result = template.hydrate(
        exprs.slice(offset, offset + arity),
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
    exprs: readonly unknown[],
    part: Part.ChildNodePart,
    session: Session,
  ): TemplateResult {
    const childNodes = [];
    const slots = [];
    let offset = 0;

    for (const template of this._templates) {
      const { arity } = template;
      const result = template.render(
        exprs.slice(offset, offset + arity),
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
