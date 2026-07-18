import re

_EP_NUM = re.compile(r"(\d+)")


def _normalize_play_url(url):
    url = (url or "").strip()
    if not url:
        return url
    lower = url.lower()
    if lower.endswith(".m3u8") or lower.endswith(".mp4"):
        return url
    if "/play/" in lower:
        return url.rstrip("/") + "/index.m3u8"
    return url


def _is_playable_url(url):
    if not url or not url.startswith("http"):
        return False
    lower = url.lower()
    if ".m3u8" in lower or ".mp4" in lower:
        return True
    if "/play/" in lower:
        return True
    return False


def _episode_sort_key(name):
    match = _EP_NUM.search(name or "")
    return int(match.group(1)) if match else 9999


def _parse_episode_group(group):
    episodes = []
    for part in group.replace("\r", "").split("#"):
        part = part.strip()
        if not part or "$" not in part:
            continue
        name, url = part.rsplit("$", 1)
        name = name.strip()
        url = url.strip()
        if not _is_playable_url(url):
            continue
        episodes.append({"name": name, "url": _normalize_play_url(url)})
    return episodes


def _dedupe_episodes(episodes):
    by_name = {}
    for ep in episodes:
        name = ep["name"]
        prev = by_name.get(name)
        if not prev:
            by_name[name] = ep
            continue
        if ".m3u8" in ep["url"].lower() and ".m3u8" not in prev["url"].lower():
            by_name[name] = ep
    result = list(by_name.values())
    result.sort(key=lambda item: _episode_sort_key(item["name"]))
    return result


def parse_play_episodes(play_url_raw):
    """解析 CMS vod_play_url，兼容 $$$ 多线路拼接与无 .m3u8 后缀的 play 链接"""
    if not play_url_raw:
        return []

    groups = play_url_raw.replace("\r", "").split("$$$")
    best = []
    best_score = (-1, -1)

    for group in groups:
        parsed = _dedupe_episodes(_parse_episode_group(group))
        if not parsed:
            continue
        m3u8_count = sum(1 for ep in parsed if ".m3u8" in ep["url"].lower())
        score = (len(parsed), m3u8_count)
        if score > best_score:
            best = parsed
            best_score = score

    return best
