const PAGE_SIZE = 36;

export function buildPageItems(current, total) {
  if (total <= 1) return [{ type: 'page', value: 1 }];

  const pages = new Set([1, total, current]);
  for (let i = current - 2; i <= current + 2; i += 1) {
    if (i >= 1 && i <= total) pages.add(i);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const items = [];
  let prev = 0;

  sorted.forEach((page) => {
    if (page - prev > 1) items.push({ type: 'ellipsis', key: `gap-${prev}-${page}` });
    items.push({ type: 'page', value: page });
    prev = page;
  });

  return items;
}

export { PAGE_SIZE };
