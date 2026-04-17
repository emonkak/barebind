import {
  Bind,
  type HostAdapter,
  type HostNode,
  Primitive,
  type VHostElement,
  type VTemplate,
} from './core.js';
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
} from './dom-node.js';
import {
  createTreeWalker,
  DOMTemplate,
  type Hole,
  HoleType,
} from './dom-template.js';

export class DOMAdapter implements HostAdapter {
  value: unknown;
  private _identifier = generateUniqueIdentifier(8);
  private _templateCache: WeakMap<readonly string[], DOMTemplate> =
    new WeakMap();

  renderNode(element: VHostElement): HostNode {
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
        document,
      ),
    );
    return renderTemplate(template);
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
          throw new Error(
            'There is no node that the hole indicates. The template may have been modified.',
          );
        }
      }

      const node = templateWalker.currentNode;
      let part: DOMPart;

      switch (hole.type) {
        case HoleType.Attribute:
          part = new AttributePart(node as Element, hole.name);
          break;
        case HoleType.Event:
          part = new EventPart(node as Element, hole.name);
          break;
        case HoleType.ChildNode:
          part = new ChildNodePart(node as Comment);
          break;
        case HoleType.Element:
          part = new ElementPart(node as Element);
          break;
        case HoleType.Live:
          part = new LivePart(node as Element, hole.name);
          break;
        case HoleType.Property:
          part = new PropertyPart(node as Element, hole.name);
          break;
        case HoleType.Text:
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
