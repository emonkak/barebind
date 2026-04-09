import {
  type Directive,
  type DirectiveHandler,
  type Lanes,
  Primitive,
  type PrimitiveHandler,
  Repeat,
  type Scope,
  type Session,
  type UpdateUnit,
} from './core.js';
import { RenderError } from './error.js';
import { NoLanes } from './lane.js';
import { createChildScope, handleError } from './scope.js';

export class Slot<TPart = unknown, TRenderer = unknown>
  implements UpdateUnit<TPart, TRenderer>
{
  private readonly _part: TPart;
  private _pendingDirective: Directive.ElementDirective;
  private _currentDirective: Directive.ElementDirective;
  private _pendingHandler: DirectiveHandler<unknown> | null = null;
  private _currentHandler: DirectiveHandler<unknown> | null = null;
  private _scope: Scope<TPart, TRenderer>;
  private _pendingLanes: Lanes = 0;
  private _dirty: boolean = false;

  constructor(
    part: TPart,
    directive: Directive.ElementDirective,
    scope: Scope<TPart, TRenderer>,
  ) {
    this._part = part;
    this._pendingDirective = directive;
    this._currentDirective = directive;
    this._scope = scope;
  }

  get part(): TPart {
    return this._part;
  }

  get directive(): Directive.ElementDirective {
    return this._pendingDirective;
  }

  get scope(): Scope<TPart, TRenderer> {
    return this._scope;
  }

  get pendingLanes(): Lanes {
    return this._pendingLanes;
  }

  set pendingLanes(lanes: Lanes) {
    this._pendingLanes = lanes;
  }

  needsRender(): boolean {
    return (
      this._pendingHandler === null ||
      this._currentHandler === null ||
      this._pendingHandler !== this._currentHandler ||
      this._pendingHandler.shouldUpdate(
        this._pendingDirective.value,
        this._currentDirective.value,
      )
    );
  }

  update(
    directive: Directive.ElementDirective,
    scope: Scope<TPart, TRenderer>,
  ): void {
    this._pendingDirective = directive;
    this._pendingHandler =
      directive.type === this._currentDirective.type &&
      directive.key === this._currentDirective.key
        ? this._currentHandler
        : null;
    this._scope = scope;
  }

  *render(session: Session): Generator<UpdateUnit> {
    const { type, value } = this._pendingDirective;
    const { adapter, lanes } = session;

    if (this._pendingHandler === null) {
      if (type === Primitive) {
        this._pendingHandler = adapter.resolvePrimitive(
          this._pendingDirective,
          this._part,
        );
        (this._pendingHandler as PrimitiveHandler<unknown>).ensureValue(
          value,
          this._part,
        );
      } else if (type === Repeat) {
        this._pendingHandler = adapter.resolveRepeat(
          this._pendingDirective,
          this._part,
        );
      } else if (typeof type === 'object') {
        this._pendingHandler = adapter.resolveTemplate(
          this._pendingDirective,
          this._part,
        );
      } else {
        this._pendingHandler = this._pendingDirective.type.resolveComponent(
          this._pendingDirective,
          this._part,
        );
      }
    }

    do {
      const scope = createChildScope(this);
      let children: Iterable<UpdateUnit>;

      this._pendingLanes &= ~lanes;

      try {
        children = this._pendingHandler.render(
          value,
          this._part,
          scope,
          session,
        );
      } catch (error) {
        try {
          handleError(this._scope, error);
        } catch (error) {
          throw new RenderError(scope, 'An error occurred during rendering.', {
            cause: error,
          });
        }
        children = [];
      }

      for (const child of children) {
        if (child.needsRender()) {
          yield child;
        }
      }

      Object.freeze(scope);
    } while ((this._pendingLanes & lanes) !== NoLanes);

    this._dirty = true;
  }

  complete(): void {
    this.commit();
    this.afterCommit();
  }

  commit(): void {
    if (this._dirty) {
      if (this._pendingHandler === this._currentHandler) {
        this._pendingHandler?.remount(
          this._currentDirective.value,
          this._pendingDirective.value,
          this._part,
        );
      } else {
        this.beforeRevert();
        this.revert();
        this._pendingHandler?.mount(this._pendingDirective.value, this._part);
      }
      this._dirty = false;
      this._currentDirective = this._pendingDirective;
      this._currentHandler = this._pendingHandler;
    }
  }

  afterCommit(): void {
    this._currentHandler?.afterMount(this._pendingDirective.value, this._part);
  }

  beforeRevert(): void {
    this._currentHandler?.beforeUnmount(
      this._pendingDirective.value,
      this._part,
    );
  }

  revert(): void {
    this._currentHandler?.unmount(this._pendingDirective.value, this._part);
    this._currentHandler = null;
  }
}
