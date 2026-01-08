import { createComponent, type RenderContext, Repeat } from 'barebind';

import type { Comment } from '../store.js';

interface CommentViewProps {
  comment: Comment;
}

export const CommentView = createComponent(function CommentView(
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
          ? CommentList({ comments: comment.comments })
          : null
      }>
    </li>
  `;
});

interface CommentListProps {
  comments: Comment[];
}

export const CommentList = createComponent(function CommentList(
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
            <${Repeat({
              items: comments,
              keySelector: (comment) => comment.id,
              valueSelector: (comment) => CommentView({ comment }),
            })}>
          </ul>
        `
        : null
    }>
  `;
});

function pluralize(n: number): string {
  return n + (n === 1 ? ' reply' : ' replies');
}
