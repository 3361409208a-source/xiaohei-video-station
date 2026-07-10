import rules from '@/data/category_rules.json';

function includesAny(text, keywords) {
  if (!text || !keywords?.length) return false;
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(String(k).toLowerCase()));
}

/**
 * 判断影片是否属于指定大类（与 main.py build_category_where 共用规则）
 */
export function matchCategory(typeName, title, t) {
  const type = typeName || '';
  const ttl = title || '';
  const rule = rules.categories[t];

  if (!rule) {
    return type === t;
  }

  if (rule.mode === 'other') {
    return !includesAny(type, rule.other_exclude || []);
  }

  const hitInclude =
    includesAny(type, rule.include) || includesAny(ttl, rule.title_include);
  if (!hitInclude) return false;

  if (includesAny(type, rule.exclude)) return false;
  if (includesAny(ttl, rule.title_exclude)) return false;

  return true;
}

/**
 * 将子分类映射到频道大类（如「动作片」→「电影」）
 */
export function mapToMajorCategory(category) {
  if (!category) return '电影';
  const lower = String(category).toLowerCase();
  for (const entry of rules.major_map || []) {
    if ((entry.match || []).some((k) => lower.includes(String(k).toLowerCase()))) {
      return entry.major;
    }
  }
  return category;
}

export function getCategoryRules() {
  return rules;
}
