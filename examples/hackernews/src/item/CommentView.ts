import type { RenderContext } from '@emonkak/ebit';
import { component, repeat } from '@emonkak/ebit/extensions';

import type { Comment } from '../store.js';

interface CommentViewProps {
  comment: Comment;
}

export function CommentView(
  { comment }: CommentViewProps,
  context: RenderContext,
): unknown {
  return context.html`
    <li class="comment">
      <div class="by">
        <a href=${`#/users/${comment.user}`}>${comment.user}</a> ${comment.time_ago} ago
      </div>
      <div class="text" .innerHTML=${comment.content}></div>
      <${
        comment.comments.length > 0
          ? component(CommentList, { comments: comment.comments })
          : null
      }>
    </li>
  `;
}

interface CommentListProps {
  comments: Comment[];
}

export function CommentList(
  { comments }: CommentListProps,
  context: RenderContext,
): unknown {
  const [isOpened, setIsOpened] = context.useState<boolean>(true);

  const handleToggleOpen = context.useCallback(() => {
    setIsOpened((isOpened) => !isOpened);
  }, []);

  return context.html`
    <div :classlist=${[{ toggle: true, open: isOpened }]}>
      <a @click=${handleToggleOpen}>
        ${isOpened ? '[-]' : '[+] ' + pluralize(comments.length) + ' collapsed'}
      </a>
    </div>
    <${
      isOpened
        ? context.html`
          <ul class="comment-children">
            <${repeat({
              source: comments,
              keySelector: (comment) => comment.id,
              valueSelector: (comment) => component(CommentView, { comment }),
            })}>
          </ul>
        `
        : null
    }>
  `;
}

function pluralize(n: number): string {
  return n + (n === 1 ? ' reply' : ' replies');
}
