/// <reference path="../../typings/scheduler.d.ts" />

import {
  type Backend,
  type CommitPhase,
  type DirectiveType,
  type EffectQueue,
  type Lanes,
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
  type TemplateMode,
} from '../core.js';
import { SyncLane } from '../lane.js';
import { AttributeType } from '../primitive/attribute.js';
import { BlackholeType } from '../primitive/blackhole.js';
import { ClassType } from '../primitive/class.js';
import { CommentType } from '../primitive/comment.js';
import { LiveType } from '../primitive/live.js';
import { isIterable } from '../primitive/primitive.js';
import { PropertyType } from '../primitive/property.js';
import { Repeat } from '../primitive/repeat.js';
import { SpreadType } from '../primitive/spread.js';
import { StyleType } from '../primitive/style.js';
import { TextType } from '../primitive/text.js';
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

  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    _options?: RequestCallbackOptions,
  ): Promise<T> {
    return new Promise((resolve) => {
      setTimeout(resolve);
    }).then(callback);
  }

  resolvePrimitive(source: unknown, part: Part): Primitive<unknown> {
    switch (part.type) {
      case PART_TYPE_ATTRIBUTE:
        if (part.name[0] === ':') {
          switch (part.name.slice(1).toLowerCase()) {
            case 'class':
              return ClassType;
            case 'style':
              return StyleType;
            default:
              return BlackholeType;
          }
        }
        return AttributeType;
      case PART_TYPE_CHILD_NODE:
        return source == null
          ? BlackholeType
          : typeof source !== 'string' && isIterable(source)
            ? Repeat
            : CommentType;
      case PART_TYPE_ELEMENT:
        return SpreadType;
      case PART_TYPE_EVENT:
        return BlackholeType;
      case PART_TYPE_LIVE:
        return LiveType;
      case PART_TYPE_PROPERTY:
        return PropertyType;
      case PART_TYPE_TEXT:
        return TextType;
    }
  }

  resolveTemplate(
    strings: readonly string[],
    exprs: readonly unknown[],
    mode: TemplateMode,
    placeholder: string,
  ): DirectiveType<readonly unknown[]> {
    return TaggedTemplate.parse(
      strings,
      exprs,
      mode,
      placeholder,
      this._document,
    );
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
