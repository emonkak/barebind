import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as esbuild from 'esbuild';

import { transformTemplates } from './transform.js';

export interface MinifyTemplateOptions {
  tagNames?: string[];
}

const FILTER_PATTERN = /\.(jsx?|tsx?)$/;

export function minifyTemplates(
  options: MinifyTemplateOptions = {},
): esbuild.Plugin {
  const {
    tagNames = [
      'dynamicHTML',
      'dynamicMath',
      'dynamicSVG',
      'html',
      'math',
      'svg',
    ],
  } = options;

  return {
    name: 'minify-templates',
    setup(build) {
      build.onLoad({ filter: FILTER_PATTERN }, async (args) => {
        const input = await fs.readFile(args.path, 'utf8');
        const extension = path.extname(args.path);
        const loader = getLoader(extension);

        try {
          // Strip types from the code.
          const result = await esbuild.transform(input, {
            loader,
          });

          // Remove whitespaces in templates.
          const transformedCode = transformTemplates(result.code, tagNames);

          return {
            contents: transformedCode,
            loader,
          };
        } catch (error) {
          console.warn(
            `Warning: Could not parse ${args.path}, skipping transformation:`,
            String(error),
          );
          return undefined;
        }
      });
    },
  };
}

function getLoader(extension: string): esbuild.Loader {
  switch (extension) {
    case '.js':
    case '.jsx':
    case '.ts':
    case '.tsx':
      return extension.slice(1) as esbuild.Loader;
    default:
      return 'js';
  }
}
