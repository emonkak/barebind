/// <reference path="../../typings/scheduler.d.ts" />

import {
  type Backend,
  ExecutionMode,
  type ExecutionModes,
} from '../backend.js';
import {
  CommitPhase,
  type EffectQueue,
  type Layout,
  type Part,
  PartType,
  type Primitive,
  type RequestCallbackOptions,
  type Template,
  type TemplateMode,
} from '../internal.js';
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
    if (phase === CommitPhase.Mutation) {
      effects.flush();
    }
  }

  getExecutionModes(): ExecutionModes {
    return ExecutionMode.NoMode;
  }

  getUpdatePriority(): TaskPriority {
    return 'user-blocking';
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
    return part.type === PartType.ChildNode ? LooseLayout : StrictLayout;
  }

  resolvePrimitive(source: unknown, part: Part): Primitive<unknown> {
    switch (part.type) {
      case PartType.Attribute:
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
      case PartType.ChildNode:
        return source != null ? CommentPrimitive : BlackholePrimitive;
      case PartType.Element:
        return SpreadPrimitive;
      case PartType.Event:
        return BlackholePrimitive;
      case PartType.Live:
        return LivePrimitive;
      case PartType.Property:
        return PropertyPrimitive;
      case PartType.Text:
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
