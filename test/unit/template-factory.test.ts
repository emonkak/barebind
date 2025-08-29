import { describe, expect, it } from 'vitest';
import { PartType } from '@/internal.js';
import { ChildNodeTemplate } from '@/template/child-node.js';
import { EmptyTemplate } from '@/template/empty.js';
import { TaggedTemplate } from '@/template/tagged.js';
import { TextTemplate } from '@/template/text.js';
import { OptimizedTemplateFactory } from '@/template-factory.js';
import { templateLiteral } from '../test-helpers.js';

const TEMPLATE_PLACEHOLDER = '__test__';

describe('OptimizedTemplateFactory', () => {
  describe('parseTemplate()', () => {
    const templateFactory = new OptimizedTemplateFactory(document);

    it('creates a TaggedTemplate', () => {
      const { strings, values } =
        templateLiteral`<div>${'Hello'}, ${'World'}!</div>`;
      const template = templateFactory.parseTemplate(
        strings,
        values,
        TEMPLATE_PLACEHOLDER,
        'html',
      );

      expect(template).toBeInstanceOf(TaggedTemplate);
      expect((template as TaggedTemplate)['template'].innerHTML).toBe(
        '<div></div>',
      );
      expect((template as TaggedTemplate)['holes']).toStrictEqual([
        {
          type: PartType.Text,
          index: 1,
          precedingText: '',
          followingText: '',
        },
        {
          type: PartType.Text,
          index: 2,
          precedingText: ', ',
          followingText: '!',
        },
      ]);
    });

    it.for([templateLiteral``, templateLiteral`\n`, templateLiteral`\n \n`])(
      'creates an EmptyTemplate if there is no contents',
      ({ strings, values }) => {
        const template = templateFactory.parseTemplate(
          strings,
          values,
          TEMPLATE_PLACEHOLDER,
          'html',
        );

        expect(template).toBeInstanceOf(EmptyTemplate);
      },
    );

    it.for([
      templateLiteral`<${'foo'}>`,
      templateLiteral`<${'foo'}/>`,
      templateLiteral`\n <${'foo'} /> \n`,
      templateLiteral`\n <!--${'foo'}--> \n`,
      templateLiteral`\n <!-- ${'foo'} --> \n`,
    ])(
      'creates a ChildNodeTemplate if there is a only child value',
      ({ strings, values }) => {
        const template = templateFactory.parseTemplate(
          strings,
          values,
          TEMPLATE_PLACEHOLDER,
          'html',
        );

        expect(template).toBeInstanceOf(ChildNodeTemplate);
      },
    );

    it.each([
      [templateLiteral`${'foo'}`, 'html'],
      [templateLiteral` ${'foo'} `, 'html'],
      [templateLiteral`(${'foo'})`, 'html'],
      [templateLiteral`<${'foo'}>`, 'textarea'],
      [templateLiteral`<!--${'foo'}-->`, 'textarea'],
    ] as const)(
      'creates a TextTemplate if there is a only text value',
      ({ strings, values }, mode) => {
        const template = templateFactory.parseTemplate(
          strings,
          values,
          TEMPLATE_PLACEHOLDER,
          mode,
        ) as TextTemplate;

        expect(template).toBeInstanceOf(TextTemplate);
        expect(template.precedingText).toBe(strings[0]);
        expect(template.followingText).toBe(strings[1]);
      },
    );
  });
});
