import fs from 'fs';
import path from 'path';
import { matchCategory, mapToMajorCategory } from './categoryRules';

export { matchCategory, mapToMajorCategory };

// 加载 sources.json 中的活跃源
function getActiveSources() {
  try {
    const filePath = path.join(process.cwd(), 'sources.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const sources = JSON.parse(data);
      return sources.filter(s => s.active);
    }
  } catch (error) {
    console.error('Failed to load sources.json in backupService:', error);
  }
  
  // 兜底默认活跃源，防止 sources.json 读取失败
  return [
    {
      "name": "量子高清",
      "api": "https://cj.lziapi.com/api.php/provide/vod/from/lzm3u8/at/json/",
      "tip": "极速",
      "active": true
    },
    {
      "name": "红牛专线",
      "api": "https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/",
      "tip": "专线",
      "active": true
    },
    {
      "name": "索尼资源",
      "api": "https://suoniapi.com/api.php/provide/vod/from/snm3u8/at/json/",
      "tip": "高清",
      "active": true
    }
  ];
}

// 统一超时 fetch 方法
async function fetchWithTimeout(url, options = {}, timeout = 6000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// 解析剧集链接
function parseEpisodes(playUrlRaw) {
  const epList = [];
  if (playUrlRaw) {
    const parts = playUrlRaw.replace(/\r/g, '').split('#');
    for (const p of parts) {
      if (p.includes('$')) {
        try {
          const subParts = p.split('$');
          const name = subParts[0].trim();
          const url = subParts.slice(1).join('$').trim();
          const urlLower = url.toLowerCase();
          if (urlLower.includes('.m3u8') || urlLower.includes('.mp4')) {
            epList.push({ name, url });
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }
  return epList;
}

// 数据格式归一化
function parseItem(item, engine) {
  const playUrlRaw = item.vod_play_url || '';
  const epList = parseEpisodes(playUrlRaw);

  let desc = item.vod_content || '';
  desc = desc.replace(/<p>/g, '').replace(/<\/p>/g, '').replace(/<br>/g, '\n').replace(/<br\s*\/?>/g, '\n');

  return {
    id: String(item.vod_id),
    vod_id: String(item.vod_id),
    title: item.vod_name || '',
    category: item.type_name || '影视',
    poster: item.vod_pic || '',
    director: item.vod_director || '',
    actor: item.vod_actor || '',
    year: item.vod_year || '',
    area: item.vod_area || '',
    remark: item.vod_remarks || '',
    description: desc,
    episodes: epList,
    source_name: engine.name,
    source_tip: engine.tip || '高清',
    update_time: item.vod_time || ''
  };
}

// 1. 获取今日热播 (最新 12 个)
export async function getLatest() {
  const sources = getActiveSources();
  const promises = sources.map(async (engine) => {
    try {
      const url = `${engine.api}?ac=detail&pg=1`;
      const res = await fetchWithTimeout(url, {}, 5000);
      const data = await res.json();
      if (data && data.list && Array.isArray(data.list)) {
        return data.list.map(item => parseItem(item, engine));
      }
    } catch (err) {
      console.error(`getLatest failed for ${engine.name}:`, err.message);
    }
    return [];
  });

  const allResults = await Promise.all(promises);
  const uniqueResults = {};
  
  // 合并并去重（保留同片多源）
  for (const list of allResults) {
    for (const item of list) {
      const key = `${item.title}::${item.source_name || item.source || ''}`;
      if (item.title && !uniqueResults[key]) {
        uniqueResults[key] = item;
      }
    }
  }

  // 排序：按更新时间倒序
  const sorted = Object.values(uniqueResults).sort((a, b) => {
    return new Date(b.update_time) - new Date(a.update_time);
  });

  return sorted.slice(0, 12);
}

// 2. 搜索影视 & 分类数据获取
export async function searchMovies(q, t, class_tag, pg = 1) {
  const sources = getActiveSources();
  
  if (q) {
    // 关键字搜索模式
    const promises = sources.map(async (engine) => {
      try {
        const url = `${engine.api}?ac=detail&pg=${pg}&wd=${encodeURIComponent(q)}`;
        const res = await fetchWithTimeout(url, {}, 5000);
        const data = await res.json();
        if (data && data.list && Array.isArray(data.list)) {
          return data.list.map(item => parseItem(item, engine));
        }
      } catch (err) {
        console.error(`searchMovies failed for ${engine.name} on keyword ${q}:`, err.message);
      }
      return [];
    });

    const allResults = await Promise.all(promises);
    const uniqueResults = {};
    for (const list of allResults) {
      for (const item of list) {
        const key = `${item.title}::${item.source_name || item.source || ''}`;
        if (item.title && !uniqueResults[key]) {
          uniqueResults[key] = item;
        }
      }
    }
    return Object.values(uniqueResults);
  } else if (t) {
    // 分类浏览模式（无 SQLite）：拉多页后内存过滤，再按 pg 真分页
    const pageNum = Math.max(1, parseInt(pg, 10) || 1);
    const pageSize = 36;
    // 多抓几页 CMS 列表，保证过滤后仍有足够条目可分页
    const pagesToFetch = [pageNum, pageNum + 1, pageNum + 2, Math.max(1, pageNum * 2)];

    const promises = [];
    for (const engine of sources) {
      for (const p of [...new Set(pagesToFetch)]) {
        promises.push(
          (async () => {
            try {
              const url = `${engine.api}?ac=detail&pg=${p}`;
              const res = await fetchWithTimeout(url, {}, 6000);
              const data = await res.json();
              if (data && data.list && Array.isArray(data.list)) {
                return data.list.map(item => parseItem(item, engine));
              }
            } catch (err) {
              console.error(`Category fetch failed for ${engine.name} page ${p}:`, err.message);
            }
            return [];
          })()
        );
      }
    }

    const allResults = await Promise.all(promises);
    const uniqueResults = {};
    for (const list of allResults) {
      for (const item of list) {
        const key = `${item.title}::${item.source_name || item.source || ''}`;
        if (item.title && !uniqueResults[key]) {
          const isCategoryMatch = matchCategory(item.category, item.title, t);
          const isTagMatch = !class_tag || item.category === class_tag;
          if (isCategoryMatch && isTagMatch) {
            uniqueResults[key] = item;
          }
        }
      }
    }

    const filteredList = Object.values(uniqueResults).sort((a, b) => {
      return new Date(b.update_time) - new Date(a.update_time);
    });

    const offset = (pageNum - 1) * pageSize;
    return filteredList.slice(offset, offset + pageSize);
  }

  return [];
}

// 3. 获取影片详情
export async function getDetail(id, src) {
  const sources = getActiveSources();
  // 查找匹配的引擎
  let engine = sources.find(e => e.name === src);
  if (!engine && sources.length > 0) {
    engine = sources[0]; // 降级为第一个源
  }

  if (engine) {
    try {
      const url = `${engine.api}?ac=detail&ids=${id}`;
      const res = await fetchWithTimeout(url, {}, 5000);
      const data = await res.json();
      if (data && data.list && data.list.length > 0) {
        return parseItem(data.list[0], engine);
      }
    } catch (err) {
      console.error(`getDetail failed for ${engine.name} id ${id}:`, err.message);
    }
  }

  // 如果按指定源找失败了，可以尝试在所有源中并发搜索这个 ID（针对 ID 在不同源中一致的情况）
  const promises = sources.map(async (eng) => {
    if (eng.name === src) return null; // 之前已经试过了
    try {
      const url = `${eng.api}?ac=detail&ids=${id}`;
      const res = await fetchWithTimeout(url, {}, 3000);
      const data = await res.json();
      if (data && data.list && data.list.length > 0) {
        return parseItem(data.list[0], eng);
      }
    } catch (err) {
      // ignore
    }
    return null;
  });

  const results = await Promise.all(promises);
  const found = results.find(item => item !== null);
  return found || null;
}

// 4. 获取子分类
export function getCategories(t) {
  const categoryMap = {
    '电影': ["动作片", "喜剧片", "爱情片", "科幻片", "恐怖片", "剧情片", "战争片", "纪录片", "灾难片", "悬疑片", "犯罪片", "奇幻片"],
    '电视剧': ["国产剧", "香港剧", "台湾剧", "韩国剧", "日本剧", "欧美剧", "海外剧", "泰国剧"],
    '动漫': ["国产动漫", "日韩动漫", "欧美动漫", "港台动漫", "海外动漫"],
    '综艺': ["大陆综艺", "港台综艺", "日韩综艺", "欧美综艺"],
    '短剧': ["短剧"]
  };
  return categoryMap[t] || [];
}

// 5. 获取解说视频 (模糊匹配“解说”)
export async function getReels(pg = 1) {
  const sources = getActiveSources();
  const promises = sources.map(async (engine) => {
    try {
      const url = `${engine.api}?ac=detail&pg=${pg}&wd=${encodeURIComponent('解说')}`;
      const res = await fetchWithTimeout(url, {}, 6000);
      const data = await res.json();
      if (data && data.list && Array.isArray(data.list)) {
        return data.list
          .map(item => parseItem(item, engine))
          .filter(item => item.title.includes('解说') || item.category.includes('解说'));
      }
    } catch (err) {
      console.error(`getReels failed for ${engine.name}:`, err.message);
    }
    return [];
  });

  const allResults = await Promise.all(promises);
  const uniqueResults = {};
  for (const list of allResults) {
    for (const item of list) {
      const key = `${item.title}::${item.source_name || item.source || ''}`;
      if (item.title && !uniqueResults[key]) {
        uniqueResults[key] = item;
      }
    }
  }

  const list = Object.values(uniqueResults).sort((a, b) => {
    return new Date(b.update_time) - new Date(a.update_time);
  });

  return list.slice(0, 30);
}
