import { describe, it, expect } from 'vitest';
import { matchCategory, mapToMajorCategory, getCategoryRules } from '../utils/categoryRules';
import { buildMovieSitemapUrl } from '../utils/sitemapUrl';
import { isSafeProxyUrl } from '../utils/proxySafety';
import { pickNextNetworkIndex } from '../utils/adFallback';
import { searchDedupKey, isValidDetailPayload } from '../utils/searchHelpers';
import { isValidInviteCode, isInviteExemptPath, normalizeInviteCode } from '../utils/inviteGate';
import { resolveAdsConfig } from '../utils/resolveAdsConfig';
import rootRules from '../../category_rules.json';
import srcRules from '../data/category_rules.json';

describe('matchCategory', () => {
  it('matches 电影 with 蓝光 and excludes 短剧/解说', () => {
    expect(matchCategory('蓝光', '某某', '电影')).toBe(true);
    expect(matchCategory('动作片', '某某', '电影')).toBe(true);
    expect(matchCategory('电影', '短剧合集', '电影')).toBe(false);
    expect(matchCategory('电影解说', '某某', '电影')).toBe(false);
  });

  it('matches 电视剧 and excludes 短剧', () => {
    expect(matchCategory('国产剧', '某某', '电视剧')).toBe(true);
    expect(matchCategory('连续剧', '某某', '电视剧')).toBe(true);
    expect(matchCategory('短剧', '某某', '电视剧')).toBe(false);
  });

  it('matches 短剧 via title', () => {
    expect(matchCategory('其他', '热门短剧', '短剧')).toBe(true);
  });

  it('matches 动漫 with 番剧', () => {
    expect(matchCategory('番剧', '某某', '动漫')).toBe(true);
  });
});

describe('mapToMajorCategory', () => {
  it('maps subcategories to majors', () => {
    expect(mapToMajorCategory('动作片')).toBe('电影');
    expect(mapToMajorCategory('国产剧')).toBe('电视剧');
    expect(mapToMajorCategory('日本番剧')).toBe('动漫');
    expect(mapToMajorCategory('竖屏短剧')).toBe('短剧');
  });
});

describe('category_rules sync', () => {
  it('keeps root and src/data rules identical', () => {
    expect(srcRules).toEqual(rootRules);
    expect(getCategoryRules()).toEqual(srcRules);
  });
});

describe('buildMovieSitemapUrl', () => {
  it('uses vod_id and source_name', () => {
    const url = buildMovieSitemapUrl({
      id: 1,
      vod_id: 999,
      title: '测试片',
      source_name: '量子高清',
    });
    expect(url).toContain(encodeURIComponent('测试片-999'));
    expect(url).toContain(`src=${encodeURIComponent('量子高清')}`);
    expect(url).not.toContain('-1?');
  });
});

describe('isSafeProxyUrl', () => {
  it('allows public https media urls', () => {
    expect(isSafeProxyUrl('https://cdn.example.com/a.m3u8').ok).toBe(true);
  });

  it('blocks private and localhost', () => {
    expect(isSafeProxyUrl('http://127.0.0.1/x').ok).toBe(false);
    expect(isSafeProxyUrl('http://localhost/x').ok).toBe(false);
    expect(isSafeProxyUrl('http://192.168.1.1/x').ok).toBe(false);
    expect(isSafeProxyUrl('http://10.0.0.1/x').ok).toBe(false);
    expect(isSafeProxyUrl('http://169.254.169.254/latest').ok).toBe(false);
    expect(isSafeProxyUrl('file:///etc/passwd').ok).toBe(false);
  });
});

describe('AdSlot pickNextNetworkIndex', () => {
  it('skips empty script and lands on image', () => {
    const networks = [
      { type: 'script', src: '' },
      { type: 'image', src: '', href: '/', label: 'promo' },
    ];
    expect(pickNextNetworkIndex(networks, 0, false)).toBe(1);
  });

  it('advances after failure', () => {
    const networks = [
      { type: 'script', src: 'https://ads.example/a.js' },
      { type: 'image', href: '/', label: 'promo' },
    ];
    expect(pickNextNetworkIndex(networks, 1, true)).toBe(1);
  });
});

describe('searchDedupKey', () => {
  it('keeps same title different sources as distinct keys', () => {
    const a = searchDedupKey({ title: '剑来', source_name: '量子高清' });
    const b = searchDedupKey({ title: '剑来', source_name: '红牛专线' });
    expect(a).not.toBe(b);
  });
});

describe('isValidDetailPayload', () => {
  it('rejects null and error payloads', () => {
    expect(isValidDetailPayload(null)).toBe(false);
    expect(isValidDetailPayload({ error: 'x' })).toBe(false);
    expect(isValidDetailPayload({ status: 'error' })).toBe(false);
    expect(isValidDetailPayload({ title: '剑来' })).toBe(true);
  });
});

describe('inviteGate', () => {
  it('validates invite codes case-sensitively after trim', () => {
    expect(isValidInviteCode(' xiaohei2026 ', ['xiaohei2026'])).toBe(true);
    expect(isValidInviteCode('wrong', ['xiaohei2026'])).toBe(false);
    expect(normalizeInviteCode('  abc  ')).toBe('abc');
  });

  it('exempts gate and api paths', () => {
    expect(isInviteExemptPath('/gate')).toBe(true);
    expect(isInviteExemptPath('/api/invite/verify')).toBe(true);
    expect(isInviteExemptPath('/movie/foo')).toBe(false);
  });
});

describe('resolveAdsConfig', () => {
  it('fills empty image href from private traffic group url', () => {
    const resolved = resolveAdsConfig(
      { enabled: true, slots: { home_below_search: { networks: [{ type: 'image', href: '', label: 'x' }] } } },
      { group_url: 'https://t.me/group' }
    );
    expect(resolved.slots.home_below_search.networks[0].href).toBe('https://t.me/group');
  });
});
