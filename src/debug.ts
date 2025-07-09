import { type Part, PartType } from './part.js';

interface JSONSerializable {
  toJSON(): unknown;
}

const UNQUOTED_PROPERTY_PATTERN = /^[A-Za-z$_][0-9A-Za-z$_]*$/;

export function inspectNode(node: Node, marker: string): string {
  return inspectAround(node, annotateNode(node, marker));
}

export function inspectPart(part: Part, marker: string): string {
  return inspectAround(part.node, annotatePart(part, marker));
}

export function inspectValue(
  value: unknown,
  maxDepth: number = 3,
  seenObjects: WeakSet<object> = new WeakSet(),
): string {
  if (maxDepth < 0) {
    return '...';
  }
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
      return Object.is(value, -0) ? '-0' : value.toString();
    case 'undefined':
      return 'undefined';
    case 'function':
      return value.name !== ''
        ? `Function(${value.name})`
        : value.constructor.name;
    case 'object':
      if (value === null) {
        return 'null';
      }
      if (seenObjects.has(value)) {
        return '[Circular]';
      }
      seenObjects.add(value);
      switch (value.constructor) {
        case Array:
          return (
            '[' +
            (value as unknown[])
              .map((v) => inspectValue(v, maxDepth - 1, seenObjects))
              .join(', ') +
            ']'
          );
        case Object: {
          const entries = Object.entries(value);
          return entries.length > 0
            ? '{ ' +
                entries
                  .map(
                    ([k, v]) =>
                      (UNQUOTED_PROPERTY_PATTERN.test(k)
                        ? k
                        : JSON.stringify(k)) +
                      ': ' +
                      inspectValue(v, maxDepth - 1, seenObjects),
                  )
                  .join(', ') +
                ' }'
            : '{}';
        }
        default:
          if (isJSONSerializable(value)) {
            return inspectValue(value.toJSON(), maxDepth - 1, seenObjects);
          }
          if (Symbol.toStringTag in value) {
            return value[Symbol.toStringTag] as string;
          }
          return value.constructor.name;
      }
    default:
      return value!.toString();
  }
}

export function markUsedValue(value: unknown): string {
  return `[[${inspectValue(value)} IS USED IN HERE!]]`;
}

function annotateNode(node: Node, marker: string): string {
  return marker + toHTML(node);
}

function annotatePart(part: Part, marker: string): string {
  switch (part.type) {
    case PartType.Attribute:
      return appendInsideTag(part.node, unquotedAttribute(part.name, marker));
    case PartType.ChildNode:
      return marker + toHTML(part.node);
    case PartType.Element:
      return appendInsideTag(part.node, marker);
    case PartType.Event:
      return appendInsideTag(
        part.node,
        unquotedAttribute('@' + part.name, marker),
      );
    case PartType.Live:
      return appendInsideTag(
        part.node,
        unquotedAttribute('$' + part.name, marker),
      );
    case PartType.Property:
      return appendInsideTag(
        part.node,
        unquotedAttribute('.' + part.name, marker),
      );
    case PartType.Text:
      return marker;
  }
}

function appendInsideTag(element: Element, contentToAppend: string): string {
  const isSelfClosing = isSelfClosingTag(element);
  const offset = isSelfClosing ? 1 : element.tagName.length + 4;
  const unclosedOpenTag = element.outerHTML.slice(
    0,
    -(element.innerHTML.length + offset),
  );
  let output = unclosedOpenTag + ' ' + contentToAppend + '>';
  if (!isSelfClosing) {
    output += element.innerHTML + closeTag(element);
  }
  return output;
}

function closeTag(element: Element): string {
  return '</' + element.tagName.toLowerCase() + '>';
}

function escapeHTML(s: string): string {
  return new Option(s).innerHTML;
}

function getComplexity(node: Node): number {
  // Complexity is calculated as follows:
  //   - increment by 1 when any element is found.
  //   - increment by 2 when an element has "class".
  //   - increment by 10 when an element has "id".
  //   - increment by 1 when an element has any attribute other than "class" or "id".
  //   - increment by 1 when a non-empty comment or text node is found.
  let complexity = 0;
  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
      if ((node as Element).hasAttribute('id')) {
        complexity += 9;
      }
      complexity +=
        (node as Element).classList.length +
        (node as Element).attributes.length +
        1;
      break;
    case Node.TEXT_NODE:
    case Node.COMMENT_NODE:
      if ((node as CharacterData).data.trim() !== '') {
        complexity += 1;
      }
      break;
  }
  return complexity;
}

function inspectAround(node: Node, marker: string): string {
  let currentNode: Node | null = node;
  let before = '';
  let after = '';
  let complexity = 0;
  do {
    for (
      let previousNode: Node | null = currentNode.previousSibling;
      previousNode !== null;
      previousNode = previousNode.previousSibling
    ) {
      before = toHTML(previousNode) + before;
      complexity += getComplexity(previousNode);
    }
    for (
      let nextNode: Node | null = currentNode.nextSibling;
      nextNode !== null;
      nextNode = nextNode.nextSibling
    ) {
      after += toHTML(nextNode);
      complexity += getComplexity(nextNode);
    }
    currentNode = currentNode.parentNode;
    if (!(currentNode instanceof Element)) {
      break;
    }
    before = openTag(currentNode) + before;
    after += closeTag(currentNode);
    complexity += getComplexity(currentNode);
  } while (complexity < 10);
  return before + marker + after;
}

function isJSONSerializable(value: unknown): value is JSONSerializable {
  return typeof (value as JSONSerializable).toJSON === 'function';
}

function isSelfClosingTag(element: Element): boolean {
  return !element.outerHTML.endsWith(closeTag(element));
}

function openTag(element: Element): string {
  // Assumption: The element is not a self-closing tag.
  const offset = element.tagName.length + 3;
  return element.outerHTML.slice(0, -(element.innerHTML.length + offset));
}

function toHTML(node: Node): string {
  return node instanceof Element
    ? (node as Element).outerHTML
    : new XMLSerializer().serializeToString(node);
}

function unquotedAttribute(name: string, value: string): string {
  return escapeHTML(name) + '=' + escapeHTML(value);
}
