/**
 * 将私域 group_url 回填到广告图片位的空 href
 */
export function resolveAdsConfig(ads, privateTraffic) {
  if (!ads) return { enabled: false, slots: {} };

  const groupUrl = privateTraffic?.group_url || '';
  const resolved = JSON.parse(JSON.stringify(ads));

  if (!groupUrl || !resolved.slots) return resolved;

  for (const slot of Object.values(resolved.slots)) {
    for (const network of slot.networks || []) {
      if (network.type === 'image' && !network.href) {
        network.href = groupUrl;
      }
    }
  }

  return resolved;
}
