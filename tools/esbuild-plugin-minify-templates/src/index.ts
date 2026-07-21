import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type * as esbuild from 'esbuild';

import { transformTemplates } from './transform.js';

export interface MinifyTemplateOptions {
  tagNames?: string[];
}

const FILTER_PATTERN = /\.(jsx?|tsx?)$/;

export function minifyTemplates(
  options: MinifyTemplateOptions = {},
): esbuild.Plugin {
  const { tagNames = ['css', 'html', 'math', 'svg'] } = options;

  return {
    name: 'minify-templates',
    setup(build) {
      build.onLoad({ filter: FILTER_PATTERN }, async (args) => {
        const input = await fs.readFile(args.path, 'utf8');
        const loader = path.extname(args.path).slice(1) as esbuild.Loader;
        try {
          const contents = await transformTemplates(input, loader, tagNames);
          return { contents, loader };
        } catch (error) {
          console.warn(
            `Could not parse ${args.path}, skipping transformation.`,
            error,
          );
          return undefined;
        }
      });
    },
  };
}
