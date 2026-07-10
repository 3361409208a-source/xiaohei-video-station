/**
 * 多联盟回退：从 fromIndex 起选下一个可用 network
 */
export function pickNextNetworkIndex(networks, fromIndex, reasonBlocked) {
  if (!Array.isArray(networks) || !networks.length) return -1;
  for (let i = Math.max(0, fromIndex); i < networks.length; i++) {
    const n = networks[i];
    if (!n) continue;
    if (n.type === 'script' && reasonBlocked && !n.src) continue;
    if (n.type === 'script' && !n.src) continue;
    if (n.type === 'image' && !n.src && !n.href && !n.label) continue;
    if (n.type === 'html' && !n.html) continue;
    return i;
  }
  return -1;
}
