import {
  Bind,
  type HostAdapter,
  type HostNode,
  Primitive,
  type VHostElement,
  type VTemplate,
} from '../core.js';
import { DOMNodeError } from './error.js';
import {
  AttributePart,
  ChildNodePart,
  DOMBind,
  DOMBlock,
  type DOMPart,
  DOMPortal,
  DOMPrimitive,
  ElementPart,
  EventPart,
  LivePart,
  PropertyPart,
  TextPart,
} from './node.js';
import {
  AttributeType,
  ChildNodeType,
  createTreeWalker,
  DOMTemplate,
  ElementType,
  EventType,
  type Hole,
  LiveType,
  PropertyType,
  TextType,
} from './template.js';

export class DOMAdapter implements HostAdapter {
  private readonly _document: Document;
  private readonly _identifier = generateUniqueIdentifier(8);
  private readonly _templateCache: WeakMap<readonly string[], DOMTemplate> =
    new WeakMap();

  constructor(document: Document = window.document) {
    this._document = document;
  }

  getIdentifier(): string {
    return this._identifier;
  }

  getTaskPriority(): TaskPriority {
    return window.event !== undefined
      ? isContinuousEvent(window.event)
        ? 'user-visible'
        : 'user-blocking'
      : 'background';
  }

  renderElement(element: VHostElement): HostNode {
    if (element.type === Bind) {
      return new DOMBind(element.props.index);
    }
    if (element.type === Primitive) {
      return new DOMPrimitive(element.props.value);
    }
    if (element.type instanceof Element) {
      return new DOMPortal(element.type);
    }
    const template = this._templateCache.getOrInsertComputed(element.type, () =>
      DOMTemplate.parse(
        (element as VTemplate).type,
        (element as VTemplate).children,
        (element as VTemplate).props.mode,
        this._identifier,
        this._document,
      ),
    );
    return renderTemplate(template);
  }

  requestCallback<T>(
    callback: () => T | PromiseLike<T>,
    options?: SchedulerPostTaskOptions,
  ): Promise<T> {
    if (typeof window.scheduler?.postTask === 'function') {
      return scheduler.postTask(callback, options);
    } else {
      return new Promise((resolve) => {
        switch (options?.priority) {
          case 'user-blocking': {
            const channel = new MessageChannel();
            channel.port1.onmessage = resolve;
            channel.port2.postMessage(null);
            break;
          }
          case 'background': {
            if (typeof requestIdleCallback === 'function') {
              requestIdleCallback(resolve);
            } else {
              setTimeout(resolve, 1);
            }
            break;
          }
          default:
            setTimeout(resolve);
        }
      }).then(callback);
    }
  }

  requestCommit(callback: () => void): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(resolve);
    }).then(callback);
  }

  startViewTransition(callback: () => void): Promise<void> {
    return typeof this._document.startViewTransition === 'function'
      ? this._document.startViewTransition(callback).updateCallbackDone
      : Promise.resolve().then(callback);
  }

  yieldToMain(): Promise<void> {
    return typeof window.scheduler?.yield === 'function'
      ? scheduler.yield()
      : new Promise((resolve) => {
          setTimeout(resolve);
        });
  }
}

function generateUniqueIdentifier(length: number): string {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(length)),
    (byte, i) =>
      i === 0
        ? String.fromCharCode(0x61 + (byte % 26))
        : (byte % 36).toString(36),
  ).join('');
}

function isContinuousEvent(event: Event): boolean {
  switch (event.type) {
    case 'drag':
    case 'dragenter':
    case 'dragleave':
    case 'dragover':
    case 'mouseenter':
    case 'mouseleave':
    case 'mousemove':
    case 'mouseout':
    case 'mouseover':
    case 'pointerenter':
    case 'pointerleave':
    case 'pointermove':
    case 'pointerout':
    case 'pointerover':
    case 'scroll':
    case 'touchmove':
    case 'wheel':
      return true;
    default:
      return false;
  }
}

function renderTemplate(template: DOMTemplate): DOMBlock {
  const fragment = template.element.ownerDocument.importNode(
    template.element.content,
    true,
  );
  const holes = template.holes;
  const parts: DOMPart[] = new Array(holes.length);

  if (holes.length > 0) {
    const templateWalker = createTreeWalker(fragment);
    let nodeIndex = 0;

    for (let holeIndex = 0, l = holes.length; holeIndex < l; holeIndex++) {
      const hole = holes[holeIndex]!;

      for (; nodeIndex <= hole.index; nodeIndex++) {
        if (templateWalker.nextNode() === null) {
          throw DOMNodeError.fromNode(
            templateWalker.currentNode,
            'There is no node that the hole indicates. The template may have been modified.',
          );
        }
      }

      const node = templateWalker.currentNode;
      let part: DOMPart;

      switch (hole.type) {
        case AttributeType:
          part = new AttributePart(node as Element, hole.name);
          break;
        case EventType:
          part = new EventPart(node as Element, hole.name);
          break;
        case ChildNodeType:
          part = new ChildNodePart(node as Comment);
          break;
        case ElementType:
          part = new ElementPart(node as Element);
          break;
        case LiveType:
          part = new LivePart(node as Element, hole.name);
          break;
        case PropertyType:
          part = new PropertyPart(node as Element, hole.name);
          break;
        case TextType:
          part = splitTextPart(templateWalker, hole);
          break;
      }

      parts[holeIndex] = part;
    }
  }

  return new DOMBlock(fragment, parts);
}

function splitTextPart(treeWalker: TreeWalker, hole: Hole.TextHole): TextPart {
  let currentNode = treeWalker.currentNode as Text;
  if (currentNode.previousSibling?.nodeType === Node.TEXT_NODE) {
    currentNode = currentNode.splitText(0);
  }
  if (hole.leadingSpan > 0) {
    currentNode = currentNode.splitText(hole.leadingSpan);
  }
  const part = new TextPart(currentNode);
  if (hole.trailingSpan > 0) {
    currentNode = currentNode.splitText(0);
  }
  treeWalker.currentNode = currentNode;
  return part;
}
