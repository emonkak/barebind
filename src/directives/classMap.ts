import {
  type AttributePart,
  type Binding,
  CommitStatus,
  type Directive,
  type DirectiveContext,
  type Effect,
  type Part,
  PartType,
  type UpdateContext,
  directiveTag,
  nameOf,
} from '../baseTypes.js';
import { shallowEqual } from '../compare.js';
import { ensureDirective, reportPart } from '../error.js';

export type ClassDeclaration = { [key: string]: boolean };

export function classMap(classes: ClassDeclaration): ClassMap {
  return new ClassMap(classes);
}

export class ClassMap implements Directive<ClassMap> {
  private readonly _classes: ClassDeclaration;

  constructor(classes: ClassDeclaration) {
    this._classes = classes;
  }

  get classes(): ClassDeclaration {
    return this._classes;
  }

  [directiveTag](part: Part, context: DirectiveContext): ClassMapBinding {
    if (part.type !== PartType.Attribute || part.name !== 'class') {
      throw new Error(
        'ClassMap directive must be used in a "class" attribute, but it is used here in ' +
          nameOf(context.block?.binding.value ?? 'ROOT') +
          ':\n' +
          reportPart(part, this),
      );
    }
    return new ClassMapBinding(this, part);
  }
}

export class ClassMapBinding implements Effect, Binding<ClassMap> {
  private _pendingValue: ClassMap;

  private _memoizedValue: ClassMap | null = null;

  private readonly _part: AttributePart;

  private _status = CommitStatus.Committed;

  constructor(value: ClassMap, part: AttributePart) {
    this._pendingValue = value;
    this._part = part;
  }

  get value(): ClassMap {
    return this._pendingValue;
  }

  get part(): AttributePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  connect(context: UpdateContext): void {
    this._requestCommit(context);
    this._status = CommitStatus.Mounting;
  }

  bind(newValue: ClassMap, context: UpdateContext): void {
    DEBUG: {
      ensureDirective(ClassMap, newValue, this._part);
    }
    if (
      this._memoizedValue === null ||
      !shallowEqual(newValue.classes, this._memoizedValue.classes)
    ) {
      this._requestCommit(context);
      this._status = CommitStatus.Mounting;
    } else {
      this._status = CommitStatus.Committed;
    }
    this._pendingValue = newValue;
  }

  unbind(context: UpdateContext): void {
    if (this._memoizedValue !== null) {
      this._requestCommit(context);
      this._status = CommitStatus.Unmounting;
    } else {
      this._status = CommitStatus.Committed;
    }
  }

  disconnect(_context: UpdateContext): void {
    this._status = CommitStatus.Committed;
  }

  commit(): void {
    switch (this._status) {
      case CommitStatus.Mounting: {
        const { classList } = this._part.node;
        const oldClasses = this._memoizedValue?.classes ?? {};
        const newClasses = this._pendingValue.classes;

        for (const className in newClasses) {
          const enabled = newClasses[className];
          classList.toggle(className, enabled);
        }

        for (const className in oldClasses) {
          if (!Object.hasOwn(newClasses, className)) {
            classList.remove(className);
          }
        }

        this._memoizedValue = this._pendingValue;
        break;
      }
      case CommitStatus.Unmounting: {
        this._part.node.className = '';
        this._memoizedValue = this._pendingValue;
        break;
      }
    }

    this._status = CommitStatus.Committed;
  }

  private _requestCommit(context: UpdateContext): void {
    if (this._status === CommitStatus.Committed) {
      context.enqueueMutationEffect(this);
    }
  }
}
