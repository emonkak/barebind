const INDENT_STRING = '  ';

// Minimum complexity score required to make a node identifiable.
const COMPLEXITY_THRESHOLD = 10;

export function formatNode(node: Node, marker: string): string {
  const annotatedLines = annotateNode(node, marker);
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
  const middleString = annotatedLines
    .map((line) => INDENT_STRING.repeat(level) + line)
    .join('\n');

  return precedingString + middleString + followingString;
}

function annotateInsideTag(element: Element, marker: string): string[] {
  const isSelfClosing = isSelfClosingTag(element);
  const offset = isSelfClosing ? 1 : element.localName.length + 4;
  const unclosedOpenTag = element.outerHTML.slice(
    0,
    -(element.innerHTML.length + offset),
  );
  const lines = [unclosedOpenTag + ' ' + marker + '>'];

  if (!isSelfClosing) {
    for (
      let child = element.firstChild;
      child !== null;
      child = child.nextSibling
    ) {
      lines.push(...prettyPrintNode(child, 1));
    }

    if (lines.length > 1) {
      lines.push(closeTag(element));
    } else {
      lines[0] += closeTag(element);
    }
  }

  return lines;
}

function annotateNode(node: Node, marker: string): string[] {
  if (node instanceof Element) {
    return annotateInsideTag(node, marker);
  } else {
    return [marker + serializeNode(node)];
  }
}

function closeTag(element: Element): string {
  return '</' + element.localName + '>';
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

function isSelfClosingTag(element: Element): boolean {
  return !element.outerHTML.endsWith(closeTag(element));
}

function openTag(element: Element): string {
  // Assumption: The element is not a self-closing tag.
  const offset = element.localName.length + 3;
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
      if (lines.length > 1) {
        lines.push(indentString + closeTag(node));
      } else {
        lines[0] += closeTag(node);
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
