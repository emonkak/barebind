const CARET_CHAR = '^';
const INDENT_STRING = '  ';
const PLACEHOLDER_STRING = '${...}';

// Minimum complexity score required to make a node identifiable.
const COMPLEXITY_THRESHOLD = 10;

export type DOMPlace =
  | {
      type: 'attribute';
      name: string;
      node: Element;
    }
  | {
      type: 'comment';
      node: Comment;
    }
  | {
      type: 'tagName';
      node: Element;
    }
  | {
      type: 'element';
      node: Element;
    }
  | {
      type: 'text';
      node: Text;
    };

export function generateNodeFrame(place: DOMPlace): string {
  const middleLines = markNodePlace(place);
  const leadingLines: string[] = [];
  const trailingLines: string[] = [];
  let currentNode: Node | null = place.node;
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
    if (!(currentNode instanceof Element)) {
      break;
    }

    shiftLines(leadingLines);
    shiftLines(trailingLines);

    leadingLines.push(toOpenTag(currentNode));
    trailingLines.push(toCloseTag(currentNode));

    complexity += getComplexity(currentNode);
    level++;
  } while (complexity < COMPLEXITY_THRESHOLD);

  const precedingString =
    leadingLines.length > 0 ? leadingLines.reverse().join('\n') + '\n' : '';
  const followingString =
    trailingLines.length > 0 ? '\n' + trailingLines.join('\n') : '';
  const middleString = middleLines
    .map((line) => INDENT_STRING.repeat(level) + line)
    .join('\n');

  return precedingString + middleString + followingString;
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

function isTagClosed(element: Element): boolean {
  return !element.outerHTML.endsWith(toCloseTag(element));
}

function markElementHead(element: Element, marker: string): string[] {
  const isClosed = isTagClosed(element);
  const tailOffset = isClosed ? 0 : element.localName.length + 3;
  const unopenedTag = element.outerHTML.slice(
    element.localName.length + 1,
    -(element.innerHTML.length + tailOffset),
  );

  const lines = [
    '<' + marker + unopenedTag,
    ' ' + CARET_CHAR.repeat(marker.length),
  ];

  if (!isClosed) {
    lines.push(...prettyPrintChildren(element));
  }

  return lines;
}

function markElementTail(element: Element, marker: string): string[] {
  const isClosed = isTagClosed(element);
  const tailOffset = isClosed ? 1 : element.localName.length + 4;
  const unclosedTag = element.outerHTML.slice(
    0,
    -(element.innerHTML.length + tailOffset),
  );

  const lines = [
    unclosedTag + ' ' + marker + '>',
    ' '.repeat(unclosedTag.length + 1) + CARET_CHAR.repeat(marker.length),
  ];

  if (!isClosed) {
    lines.push(...prettyPrintChildren(element));
  }

  return lines;
}

function markNodePlace(place: DOMPlace): string[] {
  switch (place.type) {
    case 'element':
      return markElementTail(place.node, PLACEHOLDER_STRING);
    case 'attribute':
      return markElementTail(place.node, place.name + '=' + PLACEHOLDER_STRING);
    case 'tagName':
      return markElementHead(place.node, PLACEHOLDER_STRING);
    case 'comment':
      return [
        `<!--${PLACEHOLDER_STRING}-->`,
        CARET_CHAR.repeat(PLACEHOLDER_STRING.length + 7),
      ];
    case 'text':
      return [PLACEHOLDER_STRING, CARET_CHAR.repeat(PLACEHOLDER_STRING.length)];
  }
}

function prettyPrintChildren(element: Element): string[] {
  const lines: string[] = [];

  for (
    let child = element.firstChild;
    child !== null;
    child = child.nextSibling
  ) {
    lines.push(...prettyPrintNode(child, 1));
  }

  const closeTag = toCloseTag(element);

  if (lines.length === 1) {
    lines[0] += closeTag;
  } else {
    lines.push(closeTag);
  }

  return lines;
}

function prettyPrintNode(node: Node, level: number = 0): string[] {
  const lines: string[] = [];
  const indentString = INDENT_STRING.repeat(level);

  if (node instanceof Element) {
    lines.push(indentString + toOpenTag(node));

    for (
      let currentNode = node.firstChild;
      currentNode !== null;
      currentNode = currentNode.nextSibling
    ) {
      lines.push(...prettyPrintNode(currentNode, level + 1));
    }

    if (!isTagClosed(node)) {
      if (lines.length > 1) {
        lines.push(indentString + toCloseTag(node));
      } else {
        lines[0] += toCloseTag(node);
      }
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

function toCloseTag(element: Element): string {
  return '</' + element.localName + '>';
}

function toOpenTag(element: Element): string {
  // Assumption: The tag is not closed.
  const offset = element.localName.length + 3;
  return element.outerHTML.slice(0, -(element.innerHTML.length + offset));
}
