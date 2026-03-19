/// <reference path="../../typings/scheduler.d.ts" />

import {
  type Backend,
  type CommitPhase,
  type EffectQueue,
  type Lanes,
  type Layout,
  PART_TYPE_ATTRIBUTE,
  PART_TYPE_CHILD_NODE,
  PART_TYPE_ELEMENT,
  PART_TYPE_EVENT,
  PART_TYPE_LIVE,
  PART_TYPE_PROPERTY,
  PART_TYPE_TEXT,
  type Part,
  type Primitive,
  type RequestCallbackOptions,
  type Template,
  type TemplateMode,
} from '../core.js';
import { SyncLane } from '../lane.js';
import { LooseLayout } from '../layout/loose.js';
import { StrictLayout } from '../layout/strict.js';
import { AttributePrimitive } from '../primitive/attribute.js';
import { BlackholePrimitive } from '../primitive/blackhole.js';
import { ClassPrimitive } from '../primitive/class.js';
import { CommentPrimitive } from '../primitive/comment.js';
import { LivePrimitive } from '../primitive/live.js';
import { PropertyPrimitive } from '../primitive/property.js';
import { SpreadPrimitive } from '../primitive/spread.js';
import { StylePrimitive } from '../primitive/style.js';
import { TextPrimitive } from '../primitive/text.js';
import { TaggedTemplate } from '../template/tagged.js';

export class ServerBackend implements Backend {
  private readonly _document: Document;

  constructor(document: Document) {
    this._document = document;
  }

  flushEffects(effects: EffectQueue, phase: CommitPhase): void {
    if (phase === 'mutation') {
      effects.flush();
    }
  }

  getDefaultLanes(): Lanes {
    return SyncLane;
  }

  getUpdatePriority(): TaskPriority {
    return 'user-visible';
  }

  parseTemplate(
    strings: readonly string[],
    values: readonly unknown[],
    markerIdentifier: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    return TaggedTemplate.parse(
      strings,
      values,
      markerIdentifier,
      mode,
      this._document,
    );
  }

  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    _options?: RequestCallbackOptions,
  ): Promise<T> {
    return new Promise((resolve) => {
      setTimeout(resolve);
    }).then(callback);
  }

  resolveLayout(_source: unknown, part: Part): Layout {
    return part.type === PART_TYPE_CHILD_NODE ? LooseLayout : StrictLayout;
  }

  resolvePrimitive(source: unknown, part: Part): Primitive<unknown> {
    switch (part.type) {
      case PART_TYPE_ATTRIBUTE:
        if (part.name[0] === ':') {
          switch (part.name.slice(1).toLowerCase()) {
            case 'class':
              return ClassPrimitive;
            case 'style':
              return StylePrimitive;
            default:
              return BlackholePrimitive;
          }
        }
        return AttributePrimitive;
      case PART_TYPE_CHILD_NODE:
        return source != null ? CommentPrimitive : BlackholePrimitive;
      case PART_TYPE_ELEMENT:
        return SpreadPrimitive;
      case PART_TYPE_EVENT:
        return BlackholePrimitive;
      case PART_TYPE_LIVE:
        return LivePrimitive;
      case PART_TYPE_PROPERTY:
        return PropertyPrimitive;
      case PART_TYPE_TEXT:
        return TextPrimitive;
    }
  }

  startViewTransition(callback: () => Promise<void> | void): Promise<void> {
    return Promise.resolve().then(callback);
  }

  yieldToMain(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve);
    });
  }
}
