import {
  type Directive,
  Fragment,
  type Lanes,
  type Mountable,
  Primitive,
  type Renderable,
  type Scope,
  type Session,
  type UpdateUnit,
} from './core.js';
import { RenderError } from './error.js';
import { NoLanes } from './lane.js';
import { createChildScope, handleError } from './scope.js';

const FLAG_NEEDS_RENDER = 0b01;
const FLAG_NEEDS_COMMIT = 0b10;

export class Slot<TPart = unknown> implements UpdateUnit<TPart> {
  private readonly _part: TPart;
  private _directive: Directive.ElementDirective;
  private _renderable: Renderable<unknown, TPart> | null = null;
  private _pendingMountable: Mountable<unknown, TPart> | null = null;
  private _currentMountable: Mountable<unknown, TPart> | null = null;
  private _scope: Scope<TPart>;
  private _pendingLanes: Lanes = 0;
  private _flags: number = 0;

  constructor(
    part: TPart,
    directive: Directive.ElementDirective,
    scope: Scope<TPart>,
  ) {
    this._part = part;
    this._directive = directive;
    this._scope = scope;
  }

  get part(): TPart {
    return this._part;
  }

  get directive(): Directive.ElementDirective {
    return this._directive;
  }

  get scope(): Scope<TPart> {
    return this._scope;
  }

  get pendingLanes(): Lanes {
    return this._pendingLanes;
  }

  set pendingLanes(lanes: Lanes) {
    this._pendingLanes = lanes;
  }

  needsRender(): boolean {
    return (this._flags & FLAG_NEEDS_RENDER) !== 0;
  }

  update(directive: Directive.ElementDirective, scope: Scope<TPart>): void {
    if (
      this._renderable !== null &&
      this._directive.type === directive.type &&
      this._directive.key === directive.key
    ) {
      this._pendingMountable = this._currentMountable;
      this._flags |= this._renderable.shouldUpdate(
        this._directive.value,
        directive.value,
      )
        ? FLAG_NEEDS_RENDER
        : 0;
    } else {
      this._pendingMountable = null;
      this._renderable = null;
      this._flags |= FLAG_NEEDS_RENDER;
    }
    this._directive = directive;
    this._scope = scope;
  }

  *render(session: Session<TPart>): Generator<UpdateUnit> {
    const { type, value } = this._directive;
    const { adapter, lanes } = session;

    if (type === Primitive) {
      this._renderable ??= adapter.resolvePrimitive(
        this._directive,
        this._part,
      );
      (this._renderable as Primitive<unknown>).ensureValue(value, this._part);
    } else if (type === Fragment) {
      this._renderable ??= adapter.resolveFragment(this._directive, this._part);
    } else if (typeof type === 'object') {
      this._renderable ??= adapter.resolveTemplate(this._directive, this._part);
    } else {
      this._renderable ??= type;
    }

    do {
      const scope = createChildScope(this);

      this._pendingLanes &= ~lanes;

      try {
        if (this._pendingMountable !== null) {
          this._pendingMountable.patch(value, this._part, scope, session);
        } else {
          this._pendingMountable = this._renderable.render(
            value,
            this._part,
            scope,
            session,
          );
        }
      } catch (error) {
        this._pendingMountable = null;
        try {
          handleError(this._scope, error);
        } catch (error) {
          throw new RenderError(scope, 'An error occurred during rendering.', {
            cause: error,
          });
        }
      }

      if (this._pendingMountable !== null) {
        for (const child of this._pendingMountable.children) {
          if (child.needsRender()) {
            yield child;
          }
        }
      }

      Object.freeze(scope);
    } while ((this._pendingLanes & lanes) !== NoLanes);

    this._flags |= FLAG_NEEDS_COMMIT;
    this._flags &= ~FLAG_NEEDS_RENDER;
  }

  complete(): void {
    this.commit();
    this.afterCommit();
  }

  commit(): void {
    if (this._flags & FLAG_NEEDS_COMMIT) {
      if (
        this._currentMountable !== null &&
        this._currentMountable !== this._pendingMountable
      ) {
        this._currentMountable.beforeUnmount(this._part);
        this._currentMountable.unmount(this._part);
      }
      this._pendingMountable?.mount(this._part);
      this._currentMountable = this._pendingMountable;
      this._flags &= ~FLAG_NEEDS_COMMIT;
    }
  }

  afterCommit(): void {
    this._currentMountable?.afterMount(this._part);
  }

  beforeRevert(): void {
    this._currentMountable?.beforeUnmount(this._part);
  }

  revert(): void {
    this._currentMountable?.unmount(this._part);
    this._currentMountable = null;
  }
}
