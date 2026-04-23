const CARET_CHAR = '^';
const INDENT_STRING = '  ';
const PLACEHOLDER_STRING = '${...}';

// Minimum complexity score required to make a node identifiable.
const COMPLEXITY_THRESHOLD = 10;

const serializer = new XMLSerializer();

export function annotateAttributeHole(
  element: Element,
  name: string,
): string[] {
  const closed = isClosed(element);
  const tailSpan = closed ? 1 : element.localName.length + 4;
  const outerHTML = element.outerHTML;
  const unclosedTag = outerHTML.slice(
    0,
    outerHTML.length - element.innerHTML.length - tailSpan,
  );

  const lines = [
    `${unclosedTag} ${name}=${PLACEHOLDER_STRING}>`,
    ' '.repeat(unclosedTag.length + 1) +
      CARET_CHAR.repeat(name.length + PLACEHOLDER_STRING.length + 1),
  ];

  if (!closed) {
    lines.push(...prettyPrintChildren(element, 1), toCloseTag(element));
  }

  return lines;
}

export function annotateNode(node: Node): string[] {
  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
      return annotateElement(node as Element, (node as Element).localName);
    case Node.COMMENT_NODE:
      return [
        `<!--${(node as Comment).data}-->`,
        CARET_CHAR.repeat((node as Comment).data.length + 7),
      ];
    case Node.TEXT_NODE:
      return [
        `"${(node as Text).data}"`,
        CARET_CHAR.repeat((node as Text).data.length + 2),
      ];
    default:
      return [
        `<${node.nodeName}>`,
        CARET_CHAR.repeat(node.nodeName.length + 2),
        ...prettyPrintChildren(node, 1),
        `</${node.nodeName}>`,
      ];
  }
}

export function annotateNodeHole(node: Node): string[] {
  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
      return annotateElement(node as Element, PLACEHOLDER_STRING);
    case Node.COMMENT_NODE:
      return [
        `<!--${PLACEHOLDER_STRING}-->`,
        CARET_CHAR.repeat(PLACEHOLDER_STRING.length + 7),
      ];
    case Node.TEXT_NODE:
      return [
        `"${PLACEHOLDER_STRING}"`,
        CARET_CHAR.repeat(PLACEHOLDER_STRING.length + 2),
      ];
    default:
      return [];
  }
}

export function generateNodeFrame(
  originNode: Node,
  annotatedLines: string[],
): string {
  let leadingLines: string[] = [];
  let trailingLines: string[] = [];
  let currentNode: Node | null = originNode;
  let complexity = 0;
  let level = 0;

  do {
    for (
      let previousNode = currentNode.previousSibling;
      previousNode !== null;
      previousNode = previousNode.previousSibling
    ) {
      leadingLines.push(...prettyPrintNode(previousNode).reverse());
      complexity += getComplexity(previousNode);
    }

    for (
      let nextNode = currentNode.nextSibling;
      nextNode !== null;
      nextNode = nextNode.nextSibling
    ) {
      trailingLines.push(...prettyPrintNode(nextNode));
      complexity += getComplexity(nextNode);
    }

    currentNode = currentNode.parentNode;

    if (currentNode === null || currentNode.nodeType !== Node.ELEMENT_NODE) {
      break;
    }

    leadingLines = leadingLines.map(shiftLine);
    trailingLines = trailingLines.map(shiftLine);

    // Not self-closing because it contains child nodes.
    leadingLines.push(toOpenTag(currentNode as Element));
    trailingLines.push(toCloseTag(currentNode as Element));

    complexity += getComplexity(currentNode);
    level++;
  } while (complexity < COMPLEXITY_THRESHOLD);

  const leadingString =
    leadingLines.length > 0 ? leadingLines.reverse().join('\n') + '\n' : '';
  const trailingString =
    trailingLines.length > 0 ? '\n' + trailingLines.join('\n') : '';
  const middle = annotatedLines
    .map((line) => INDENT_STRING.repeat(level) + line)
    .join('\n');

  return leadingString + middle + trailingString;
}

function annotateElement(element: Element, annotation: string): string[] {
  const closed = isClosed(element);
  const tailSpan = closed ? 0 : element.localName.length + 3;
  const outerHTML = element.outerHTML;
  const unopenedTag = outerHTML.substring(
    element.localName.length + 1,
    outerHTML.length - element.innerHTML.length - tailSpan,
  );

  const lines = [
    '<' + annotation + unopenedTag,
    CARET_CHAR.repeat(annotation.length + unopenedTag.length + 1),
  ];

  if (!closed) {
    lines.push(...prettyPrintChildren(element, 1), toCloseTag(element));
  }

  return lines;
}

function getComplexity(node: Node): number {
  let complexity = 0;
  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
      complexity +=
        1 +
        (node as Element).classList.length +
        (node as Element).attributes.length;
      break;
    case Node.TEXT_NODE:
    case Node.COMMENT_NODE:
      if ((node as CharacterData).data.trim() !== '') {
        complexity++;
      }
      break;
  }
  return complexity;
}

function isClosed(element: Element): boolean {
  return !element.outerHTML.endsWith(toCloseTag(element));
}

function prettyPrintChildren(node: Node, level: number): string[] {
  const lines: string[] = [];

  for (let child = node.firstChild; child !== null; child = child.nextSibling) {
    lines.push(...prettyPrintNode(child, level));
  }

  return lines;
}

function prettyPrintNode(node: Node, level: number = 0): string[] {
  const lines: string[] = [];
  const indent = INDENT_STRING.repeat(level);

  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
      if (isClosed(node as Element)) {
        lines.push(indent + (node as Element).outerHTML);
        return lines;
      }

      lines.push(
        indent + toOpenTag(node as Element),
        ...prettyPrintChildren(node, level + 1),
      );

      if (lines.length > 1) {
        lines.push(indent + toCloseTag(node as Element));
      } else {
        lines[0] += toCloseTag(node as Element);
      }
      break;
    case Node.COMMENT_NODE:
      lines.push(indent + serializeNode(node));
      break;
    case Node.TEXT_NODE:
      lines.push(indent + JSON.stringify((node as Text).data));
      break;
  }

  return lines;
}

function serializeNode(node: Node): string {
  return serializer.serializeToString(node);
}

function shiftLine(line: string): string {
  return line !== '' ? INDENT_STRING + line : line;
}

function toCloseTag(element: Element): string {
  return '</' + element.localName + '>';
}

function toOpenTag(element: Element): string {
  // Assumption: The tag is not self-closing.
  const offset = element.localName.length + 3;
  return element.outerHTML.slice(0, -(element.innerHTML.length + offset));
}
