import { type Part, PartType, isDirective } from './baseTypes.js';

export function ensureDirective<
  TExpectedClass extends Function,
  TExpectedValue,
>(
  expectedClass: TExpectedClass,
  actualValue: unknown,
  part: Part,
): asserts actualValue is TExpectedValue {
  if (!(actualValue instanceof expectedClass)) {
    throw new Error(
      'The value must be a instance of ' +
        expectedClass.name +
        ' directive, but got "' +
        nameOf(actualValue) +
        '". Consider using Either, Cached, or Keyed directive instead.\n' +
        reportPart(part, reportUsedValue(actualValue)),
    );
  }
}

export function ensureNonDirective(value: unknown, part: Part): void {
  if (isDirective(value)) {
    throw new Error(
      'The value must not be a directive, but got "' +
        nameOf(value) +
        '". Consider using Either, Cached, or Keyed directive instead.\n' +
        reportPart(part, reportUsedValue(value)),
    );
  }
}

export function nameOf(value: unknown): string {
  if (typeof value === 'object') {
    return value === null
      ? 'null'
      : Symbol.toStringTag in value
        ? (value[Symbol.toStringTag] as string)
        : value.constructor.name;
  }
  if (typeof value === 'function') {
    return value.name !== '' ? value.name : 'Function';
  }
  if (typeof value === 'undefined') {
    return 'undefined';
  }
  return JSON.stringify(value);
}

export function reportPart(part: Part, marker: string): string {
  let currentNode: Node | null = part.node;
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
  return before + markPart(part, marker) + after;
}

export function reportUsedValue(value: unknown): string {
  return `[[${nameOf(value)} IS USED IN HERE!]]`;
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

function isSelfClosingTag(element: Element): boolean {
  return !element.outerHTML.endsWith(closeTag(element));
}

function markPart(part: Part, marker: string): string {
  switch (part.type) {
    case PartType.Attribute:
      return appendInsideTag(part.node, unquotedAttribute(part.name, marker));
    case PartType.ChildNode:
      return marker + toHTML(part.node);
    case PartType.Element:
      return appendInsideTag(part.node, marker);
    case PartType.Property:
      return appendInsideTag(
        part.node,
        unquotedAttribute('.' + part.name, marker),
      );
    case PartType.Event:
      return appendInsideTag(
        part.node,
        unquotedAttribute('@' + part.name, marker),
      );
    case PartType.Node:
      return marker;
  }
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
