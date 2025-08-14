import type { Template, TemplateFactory, TemplateMode } from './core.js';
import { ChildNodeTemplate } from './template/child-node.js';
import { EmptyTemplate } from './template/empty.js';
import { normalizeText, TaggedTemplate } from './template/tagged.js';
import { TextTemplate } from './template/text.js';

const START_TAG_PATTERN = /^<(?:!--\s*)?$/;
const END_TAG_PATTERN = /^\s*(?:\/|--)?>$/;

export class OptimizedTemplateFactory implements TemplateFactory {
  private readonly _document: Document;

  private readonly _childNodeTemplate = new ChildNodeTemplate();

  private readonly _emptyTemplate = new EmptyTemplate();

  private readonly _textTemplate = new TextTemplate();

  constructor(document: Document) {
    this._document = document;
  }

  parseTemplate(
    strings: readonly string[],
    binds: readonly unknown[],
    placeholder: string,
    mode: TemplateMode,
  ): Template<readonly unknown[]> {
    if (binds.length === 0) {
      // Assert: strings.length === 1
      if (normalizeText(strings[0]!) === '') {
        return this._emptyTemplate;
      }
    } else if (binds.length === 1) {
      // Assert: strings.length === 2
      const precedingText = normalizeText(strings[0]!);
      const followingText = normalizeText(strings[1]!);

      if (
        mode === 'textarea' ||
        (!precedingText.includes('<') && !followingText.includes('<'))
      ) {
        // Tags are nowhere, so it is a plain text.
        return precedingText === '' && followingText === ''
          ? this._textTemplate
          : new TextTemplate(precedingText, followingText);
      }

      if (isIsolatedTagInterpolation(precedingText, followingText)) {
        // There is only one tag.
        return this._childNodeTemplate;
      }
    }

    return TaggedTemplate.parse(
      strings,
      binds,
      placeholder,
      mode,
      this._document,
    );
  }
}

export function isIsolatedTagInterpolation(
  precedingText: string,
  followingText: string,
): boolean {
  return (
    START_TAG_PATTERN.test(precedingText) && END_TAG_PATTERN.test(followingText)
  );
}
