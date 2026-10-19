const MAX_HASHTAGS_PER_POST = 10;

// "#NYSC2026" and "#corper_life" become "nysc2026" and "corper_life".
// A # in the middle of a word or link ("site.com/page#top") is not a
// hashtag, and a post can carry at most 10 so nobody can flood the
// hashtag tables with one message.
export function extractHashtags(content: string): string[] {
  const tags = new Set<string>();

  for (const match of content.matchAll(/(?:^|\s)#([a-zA-Z0-9_]{1,50})(?![a-zA-Z0-9_])/g)) {
    tags.add(match[1].toLowerCase());

    if (tags.size >= MAX_HASHTAGS_PER_POST) {
      break;
    }
  }

  return Array.from(tags);
}
