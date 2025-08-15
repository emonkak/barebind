import { component, type RenderContext, repeat } from 'barebind';

import type { Comment } from '../store.js';

interface CommentViewProps {
  comment: Comment;
}

export function CommentView(
  { comment }: CommentViewProps,
  $: RenderContext,
): unknown {
  return $.html`
    <li class="comment">
      <div class="by">
        <a href=${`#/users/${comment.user}`}>${comment.user}</a> ${comment.time_ago}
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
  $: RenderContext,
): unknown {
  const [isOpened, setIsOpened] = $.useState<boolean>(true);

  const handleToggleOpen = $.useCallback(() => {
    setIsOpened((isOpened) => !isOpened);
  }, []);

  return $.html`
    <div :class=${{ _: 'toggle', open: isOpened }}>
      <a @click=${handleToggleOpen}>
        ${isOpened ? '[-]' : '[+] ' + pluralize(comments.length) + ' collapsed'}
      </a>
    </div>
    <${
      isOpened
        ? $.html`
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
