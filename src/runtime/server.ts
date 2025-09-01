/// <reference path="../../typings/scheduler.d.ts" />

import {
  CommitPhase,
  type Effect,
  type Part,
  PartType,
  type Primitive,
  type RequestCallbackOptions,
  type SlotType,
  type Template,
  type TemplateMode,
} from '../internal.js';
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
import { LooseSlot } from '../slot/loose.js';
import { StrictSlot } from '../slot/strict.js';
import { TaggedTemplate } from '../template/tagged.js';

export class ServerBackend implements RuntimeBackend {
  private readonly _document: Document;

  constructor(document: Document) {
    this._document = document;
  }

  commitEffects(effects: Effect[], phase: CommitPhase): void {
    if (phase === CommitPhase.Mutation) {
      for (let i = 0, l = effects.length; i < l; i++) {
        effects[i]!.commit();
      }
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

  requestCallback(
    callback: () => Promise<void> | void,
    _options?: RequestCallbackOptions,
  ): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve);
    }).then(callback);
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

  resolveSlotType(_value: unknown, part: Part): SlotType {
    switch (part.type) {
      case PartType.ChildNode:
        return LooseSlot;
      default:
        return StrictSlot;
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
