import { $toDirective, isBindable } from './directive.js';
import { type Part, PartType } from './part.js';

const UNQUOTED_PROPERTY_PATTERN = /^[A-Za-z$_][0-9A-Za-z$_]*$/;

const INDENT_STRING = '  ';

// Minimum complexity score required to make a node identifiable.
const COMPLEXITY_THRESHOLD = 10;

export function inspectNode(node: Node, marker: string): string {
  return inspectAround(node, annotateNode(node, marker));
}

export function inspectPart(part: Part, marker: string): string {
  return inspectAround(part.node, annotatePart(part, marker));
}

export function inspectValue(
  value: unknown,
  maxDepth: number = 3,
  seenObjects: object[] = [],
): string {
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
      if (seenObjects.includes(value)) {
        return '[Circular]';
      }
      seenObjects.push(value);
      try {
        switch (value.constructor) {
          case Array:
            if (
              maxDepth < seenObjects.length &&
              (value as unknown[]).length > 0
            ) {
              return '[...]';
            }
            return (
              '[' +
              (value as unknown[])
                .map((v) => inspectValue(v, maxDepth, seenObjects))
                .join(', ') +
              ']'
            );
          case Object:
          case null:
          case undefined: {
            if (
              maxDepth < seenObjects.length &&
              Object.keys(value).length > 0
            ) {
              return '{...}';
            }
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
                        inspectValue(v, maxDepth, seenObjects),
                    )
                    .join(', ') +
                  ' }'
              : '{}';
          }
          default:
            if (isBindable(value)) {
              const directive = value[$toDirective]();
              return (
                directive.type.displayName +
                '(' +
                inspectValue(directive.value, maxDepth, seenObjects) +
                ')'
              );
            }
            if (Symbol.toStringTag in value) {
              return value[Symbol.toStringTag] as string;
            }
            return value.constructor.name;
        }
      } finally {
        seenObjects.pop();
      }
    default:
      return value!.toString();
  }
}

export function markUsedValue(value: unknown): string {
  return `[[${inspectValue(value)} IS USED IN HERE!]]`;
}

function annotateInsideTag(element: Element, contentToAppend: string): string {
  const isSelfClosing = isSelfClosingTag(element);
  const offset = isSelfClosing ? 1 : element.tagName.length + 4;
  const unclosedOpenTag = element.outerHTML.slice(
    0,
    -(element.innerHTML.length + offset),
  );
  let output = unclosedOpenTag + ' ' + contentToAppend + '>';
  if (!isSelfClosing) {
    const children = element.firstChild !== null ? '...' : '';
    output += children + closeTag(element);
  }
  return output;
}

function annotateNode(node: Node, marker: string): string {
  if (node instanceof Element) {
    return annotateInsideTag(node, marker);
  } else {
    return marker + serializeNode(node);
  }
}

function annotatePart(part: Part, marker: string): string {
  switch (part.type) {
    case PartType.Attribute:
      return annotateInsideTag(part.node, unquotedAttribute(part.name, marker));
    case PartType.Element:
      return annotateInsideTag(part.node, marker);
    case PartType.Event:
      return annotateInsideTag(
        part.node,
        unquotedAttribute('@' + part.name, marker),
      );
    case PartType.Live:
      return annotateInsideTag(
        part.node,
        unquotedAttribute('$' + part.name, marker),
      );
    case PartType.Property:
      return annotateInsideTag(
        part.node,
        unquotedAttribute('.' + part.name, marker),
      );
    case PartType.ChildNode:
    case PartType.Text:
      return marker;
  }
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
  //   - increment by 8 when an element has the ID.
  //   - increment by 1 when an element has any class.
  //   - increment by 1 when an element has any attribute.
  //   - increment by 1 when a non-empty comment or text node is found.
  let complexity = 0;
  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
      if ((node as Element).hasAttribute('id')) {
        complexity += 8;
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
  const precedingLines: string[] = [];
  const followingLines: string[] = [];
  let currentNode: Node | null = node;
  let complexity = 0;
  let level = 0;

  do {
    for (
      let previousNode = currentNode.previousSibling;
      previousNode !== null;
      previousNode = previousNode.previousSibling
    ) {
      precedingLines.push(...prettyPrintNode(previousNode).reverse());
      complexity += getComplexity(previousNode);
    }

    for (
      let nextNode = currentNode.nextSibling;
      nextNode !== null;
      nextNode = nextNode.nextSibling
    ) {
      followingLines.push(...prettyPrintNode(nextNode));
      complexity += getComplexity(nextNode);
    }

    currentNode = currentNode.parentNode;
    if (!(currentNode instanceof Element)) {
      break;
    }

    shiftLines(precedingLines);
    shiftLines(followingLines);

    precedingLines.push(openTag(currentNode));
    followingLines.push(closeTag(currentNode));
    complexity += getComplexity(currentNode);
    level++;
  } while (complexity < COMPLEXITY_THRESHOLD);

  const precedingString =
    precedingLines.length > 0 ? precedingLines.reverse().join('\n') + '\n' : '';
  const followingString =
    followingLines.length > 0 ? '\n' + followingLines.join('\n') : '';
  const middleString = INDENT_STRING.repeat(level) + marker;

  return precedingString + middleString + followingString;
}

function isSelfClosingTag(element: Element): boolean {
  return !element.outerHTML.endsWith(closeTag(element));
}

function openTag(element: Element): string {
  // Assumption: The element is not a self-closing tag.
  const offset = element.tagName.length + 3;
  return element.outerHTML.slice(0, -(element.innerHTML.length + offset));
}

function prettyPrintNode(node: Node, level: number = 0): string[] {
  const lines: string[] = [];
  const indentString = INDENT_STRING.repeat(level);

  if (node instanceof Element) {
    lines.push(indentString + openTag(node));

    for (
      let currentNode = node.firstChild;
      currentNode !== null;
      currentNode = currentNode.nextSibling
    ) {
      lines.push(...prettyPrintNode(currentNode, level + 1));
    }

    if (!isSelfClosingTag(node)) {
      lines.push(indentString + closeTag(node));
    }
  } else {
    lines.push(indentString + serializeNode(node));
  }

  return lines;
}

function serializeNode(node: Node): string {
  return new XMLSerializer().serializeToString(node);
}

function shiftLines(lines: string[]): void {
  for (let i = 0, l = lines.length; i < l; i++) {
    if (lines[i] !== '') {
      lines[i] = INDENT_STRING + lines[i];
    }
  }
}

function unquotedAttribute(name: string, value: string): string {
  return escapeHTML(name) + '=' + escapeHTML(value);
}
