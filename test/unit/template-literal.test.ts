import { describe, expect, it } from 'vitest';
import { Literal, TemplateLiteralPreprocessor } from '@/template-literal.js';
import { templateLiteral } from '../test-utils.js';

describe('Literal', () => {
  describe('toString()', () => {
    it('should return the string', () => {
      const s = 'foo';
      expect(new Literal(s).toString()).toBe(s);
    });
  });

  describe('valueOf()', () => {
    it('should return the string', () => {
      const s = 'foo';
      expect(new Literal(s).valueOf()).toBe(s);
    });
  });
});

describe('TemplateLiteralPreprocessor', () => {
  const createDate = (year: String, month: String, day: String) =>
    templateLiteral`${year}-${month}-${day}`;

  const createElement = (type: String, children: String) =>
    templateLiteral`<${type}>${children}</${type}>`;

  it('returns the same strings as the argument if there are no literals', () => {
    const templateLiteralPreprocessor = new TemplateLiteralPreprocessor();
    const template = createElement('div', 'foo');
    const preprocessedTemplate = templateLiteralPreprocessor.process(
      template.strings,
      template.values,
    );

    expect(preprocessedTemplate.strings).toStrictEqual(['<', '>', '</', '>']);
    expect(preprocessedTemplate.strings).toBe(template.strings);
    expect(preprocessedTemplate.values).toStrictEqual(['div', 'foo', 'div']);
    expect(
      templateLiteralPreprocessor.process(template.strings, template.values)
        .strings,
    ).toBe(preprocessedTemplate.strings);
  });

  it('returns the same strings as previous one if static strings is the same', () => {
    const templateLiteralPreprocessor = new TemplateLiteralPreprocessor();
    const template1 = createElement(new Literal('div'), 'foo');
    const template2 = createElement(new Literal('div'), 'bar');
    const preprocessedTemplate1 = templateLiteralPreprocessor.process(
      template1.strings,
      template1.values,
    );
    const preprocessedTemplate2 = templateLiteralPreprocessor.process(
      template2.strings,
      template2.values,
    );

    expect(preprocessedTemplate1.strings).toStrictEqual(['<div>', '</div>']);
    expect(preprocessedTemplate1.strings).toBe(preprocessedTemplate2.strings);
    expect(preprocessedTemplate1.values).toStrictEqual(['foo']);
    expect(preprocessedTemplate2.values).toStrictEqual(['bar']);
    expect(
      templateLiteralPreprocessor.process(template1.strings, template1.values)
        .strings,
    ).toBe(preprocessedTemplate1.strings);
    expect(
      templateLiteralPreprocessor.process(template2.strings, template2.values)
        .strings,
    ).toBe(preprocessedTemplate2.strings);
  });

  it('returns a new strings if the literal changes', () => {
    const templateLiteralPreprocessor = new TemplateLiteralPreprocessor();
    const template1 = createElement(new Literal('div'), 'foo');
    const template2 = createElement(new Literal('span'), 'foo');
    const preprocessedTemplate1 = templateLiteralPreprocessor.process(
      template1.strings,
      template1.values,
    );
    const preprocessedTemplate2 = templateLiteralPreprocessor.process(
      template2.strings,
      template2.values,
    );

    expect(preprocessedTemplate1.strings).toStrictEqual(['<div>', '</div>']);
    expect(preprocessedTemplate2.strings).toStrictEqual(['<span>', '</span>']);
    expect(preprocessedTemplate1.values).toStrictEqual(['foo']);
    expect(preprocessedTemplate2.values).toStrictEqual(['foo']);
    expect(
      templateLiteralPreprocessor.process(template1.strings, template1.values)
        .strings,
    ).toBe(preprocessedTemplate1.strings);
    expect(
      templateLiteralPreprocessor.process(template2.strings, template2.values)
        .strings,
    ).toBe(preprocessedTemplate2.strings);
  });

  it('returns a new strings if the literal position changes', () => {
    const templateLiteralPreprocessor = new TemplateLiteralPreprocessor();
    const template1 = createDate(new Literal('1990'), new Literal('01'), '01');
    const template2 = createDate(new Literal('1990'), '01', new Literal('01'));
    const preprocessedTemplate1 = templateLiteralPreprocessor.process(
      template1.strings,
      template1.values,
    );
    const preprocessedTemplate2 = templateLiteralPreprocessor.process(
      template2.strings,
      template2.values,
    );

    expect(preprocessedTemplate1.strings).toStrictEqual(['1990-01-', '']);
    expect(preprocessedTemplate2.strings).toStrictEqual(['1990-', '-01']);
    expect(preprocessedTemplate1.values).toStrictEqual(['01']);
    expect(preprocessedTemplate2.values).toStrictEqual(['01']);
    expect(
      templateLiteralPreprocessor.process(template1.strings, template1.values)
        .strings,
    ).toBe(preprocessedTemplate1.strings);
    expect(
      templateLiteralPreprocessor.process(template2.strings, template2.values)
        .strings,
    ).toBe(preprocessedTemplate2.strings);
  });

  it('returns a new strings if the template changes', () => {
    const templateLiteralPreprocessor = new TemplateLiteralPreprocessor();
    const template1 = templateLiteral`<div>Hello, ${'World'}!</div>`;
    const template2 = templateLiteral`<div>Hello, ${'World'}!</div>`;
    const preprocessedTemplate1 = templateLiteralPreprocessor.process(
      template1.strings,
      template1.values,
    );
    const preprocessedTemplate2 = templateLiteralPreprocessor.process(
      template2.strings,
      template2.values,
    );

    expect(preprocessedTemplate1.strings).toStrictEqual([
      '<div>Hello, ',
      '!</div>',
    ]);
    expect(preprocessedTemplate2.strings).toStrictEqual([
      '<div>Hello, ',
      '!</div>',
    ]);
    expect(preprocessedTemplate1.strings).not.toBe(
      preprocessedTemplate2.strings,
    );
    expect(preprocessedTemplate1.values).toStrictEqual(['World']);
    expect(preprocessedTemplate2.values).toStrictEqual(['World']);
    expect(
      templateLiteralPreprocessor.process(template1.strings, template1.values)
        .strings,
    ).toBe(preprocessedTemplate1.strings);
    expect(
      templateLiteralPreprocessor.process(template2.strings, template2.values)
        .strings,
    ).toBe(preprocessedTemplate2.strings);
  });
});
