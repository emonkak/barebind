/// <reference path="../../typings/scheduler.d.ts" />

import {
  CommitPhase,
  type Effect,
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
import type { Runtime, RuntimeBackend } from '../runtime.js';
import { TaggedTemplate } from '../template/tagged.js';

export class ServerBackend implements RuntimeBackend {
  private readonly _document: Document;

  constructor(document: Document) {
    this._document = document;
  }

  commitEffects(effects: Effect[], phase: CommitPhase): void {
    switch (phase) {
      case CommitPhase.Mutation:
        for (let i = effects.length - 1; i >= 0; i--) {
          effects[i]!.commit();
        }
        break;
    }
  }

  flushUpdate(runtime: Runtime): void {
    runtime.flushSync();
  }

  getTaskPriority(): TaskPriority {
    return 'user-blocking';
  }

  parseTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    placeholder: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    return TaggedTemplate.parse(
      strings,
      binds,
      placeholder,
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

  resolveLayout(_value: unknown, part: Part): Layout {
    return part.type === PartType.ChildNode ? LooseLayout : StrictLayout;
  }

  resolvePrimitive(value: unknown, part: Part): Primitive<unknown> {
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
        return value != null ? CommentPrimitive : BlackholePrimitive;
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
