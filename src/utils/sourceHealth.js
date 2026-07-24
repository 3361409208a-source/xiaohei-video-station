/**
 * 播放源健康度 + 偏好记忆 + 开播探活
 * 全部存在 localStorage，纯前端，无需后端改动
 */

const HEALTH_KEY = 'xh_source_health_v1';
const PREFER_KEY = 'xh_source_prefer_v1';

const MAX_HEALTH_ENTRIES = 80;
const MAX_PREFER_ENTRIES = 60;

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readStore(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  return safeParse(window.localStorage.getItem(key), fallback);
}

function writeStore(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

function trimMap(map, max) {
  const entries = Object.entries(map);
  if (entries.length <= max) return map;
  entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
  return Object.fromEntries(entries.slice(0, max));
}

/** 单源健康分：成功加权，失败/超时降权 */
export function getSourceScore(sourceName) {
  if (!sourceName) return 0;
  const map = readStore(HEALTH_KEY, {});
  const row = map[sourceName];
  if (!row) return 0;
  const success = row.success || 0;
  const fail = row.fail || 0;
  const timeout = row.timeout || 0;
  return success * 3 - fail * 2 - timeout * 1;
}

export function recordSourceSuccess(sourceName) {
  if (!sourceName) return;
  const map = readStore(HEALTH_KEY, {});
  const prev = map[sourceName] || { success: 0, fail: 0, timeout: 0 };
  map[sourceName] = {
    ...prev,
    success: (prev.success || 0) + 1,
    updatedAt: Date.now(),
  };
  writeStore(HEALTH_KEY, trimMap(map, MAX_HEALTH_ENTRIES));
}

export function recordSourceFailure(sourceName, kind = 'fail') {
  if (!sourceName) return;
  const map = readStore(HEALTH_KEY, {});
  const prev = map[sourceName] || { success: 0, fail: 0, timeout: 0 };
  const next = { ...prev, updatedAt: Date.now() };
  if (kind === 'timeout') next.timeout = (prev.timeout || 0) + 1;
  else next.fail = (prev.fail || 0) + 1;
  map[sourceName] = next;
  writeStore(HEALTH_KEY, trimMap(map, MAX_HEALTH_ENTRIES));
}

export function getPreferredSource(title) {
  if (!title) return '';
  const map = readStore(PREFER_KEY, {});
  return map[title] || '';
}

export function setPreferredSource(title, sourceName) {
  if (!title || !sourceName) return;
  const map = readStore(PREFER_KEY, {});
  map[title] = sourceName;
  // 附带时间戳方便裁剪
  map[`__meta__${title}`] = Date.now();
  const titles = Object.keys(map).filter((k) => !k.startsWith('__meta__'));
  if (titles.length > MAX_PREFER_ENTRIES) {
    titles
      .sort((a, b) => (map[`__meta__${b}`] || 0) - (map[`__meta__${a}`] || 0))
      .slice(MAX_PREFER_ENTRIES)
      .forEach((t) => {
        delete map[t];
        delete map[`__meta__${t}`];
      });
  }
  writeStore(PREFER_KEY, map);
}

/**
 * 按：指定偏好 > 片源记忆 > 健康分 排序
 */
export function sortSourcesByHealth(list, { preferredName = '', rememberedName = '' } = {}) {
  if (!Array.isArray(list) || !list.length) return [];
  const rank = (item) => {
    const name = item.source_name || item.source || '';
    let bonus = getSourceScore(name);
    if (rememberedName && name === rememberedName) bonus += 1000;
    if (preferredName && name === preferredName) bonus += 2000;
    return bonus;
  };
  return [...list].sort((a, b) => rank(b) - rank(a));
}

function sourceNameOf(item) {
  return item?.source_name || item?.source || '';
}

function vodIdOf(item) {
  return item?.vod_id || item?.id;
}

/** 通过本站 proxy 探测 m3u8 是否可读 */
export async function probeM3u8(playUrl, timeoutMs = 5000) {
  if (!playUrl) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`/api/proxy?url=${encodeURIComponent(playUrl)}`, {
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const text = await res.text();
    return text.includes('#EXTM3U');
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 拉详情 + 探活首集，成功则返回 { item, detail, episode }
 */
export async function probeSource(item, timeoutMs = 6000) {
  const sName = sourceNameOf(item);
  const vodId = vodIdOf(item);
  if (!sName || !vodId) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `/api/detail?id=${encodeURIComponent(String(vodId))}&src=${encodeURIComponent(sName)}`,
      { signal: controller.signal },
    );
    const detail = await res.json();
    if (!detail || detail.error || !detail.episodes?.length) {
      recordSourceFailure(sName, 'fail');
      return null;
    }
    const episode = detail.episodes[0];
    const ok = await probeM3u8(episode.url, Math.min(5000, timeoutMs));
    if (!ok) {
      recordSourceFailure(sName, 'fail');
      return null;
    }
    return { item, detail, episode };
  } catch (err) {
    recordSourceFailure(sName, err?.name === 'AbortError' ? 'timeout' : 'fail');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 对候选源并行探活，返回第一个可用结果
 */
export async function raceFirstPlayable(candidates, { timeoutMs = 6500 } = {}) {
  const list = (candidates || []).filter(Boolean);
  if (!list.length) return null;

  return new Promise((resolve) => {
    let pending = list.length;
    let done = false;

    list.forEach((item) => {
      probeSource(item, timeoutMs)
        .then((result) => {
          if (result && !done) {
            done = true;
            resolve(result);
          }
        })
        .catch(() => {})
        .finally(() => {
          pending -= 1;
          if (pending <= 0 && !done) resolve(null);
        });
    });
  });
}

/**
 * 选出探活候选：偏好/记忆优先，再取健康分 TopN
 */
export function pickProbeCandidates(list, { preferredName = '', rememberedName = '', topN = 3 } = {}) {
  const sorted = sortSourcesByHealth(list, { preferredName, rememberedName });
  const picked = [];
  const seen = new Set();

  const push = (item) => {
    if (!item) return;
    const name = sourceNameOf(item);
    if (!name || seen.has(name)) return;
    seen.add(name);
    picked.push(item);
  };

  if (preferredName) push(sorted.find((i) => sourceNameOf(i) === preferredName));
  if (rememberedName) push(sorted.find((i) => sourceNameOf(i) === rememberedName));
  for (const item of sorted) {
    if (picked.length >= topN) break;
    push(item);
  }
  return picked;
}
