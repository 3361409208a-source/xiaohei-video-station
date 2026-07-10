/**
 * 搜索结果去重键：同片名不同源保留多条，供换源使用
 */
export function searchDedupKey(item) {
  const title = item?.title || '';
  const source = item?.source_name || item?.source || '';
  return `${title}::${source}`;
}

/**
 * 详情响应是否视为有效（null / error 结构均无效）
 */
export function isValidDetailPayload(data) {
  return Boolean(data && data.status !== 'error' && !data.error && data.title);
}
