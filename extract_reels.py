import json
import os

# 从现有的 sitemap_data.json 提取解说视频
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SITEMAP_PATH = os.path.join(BASE_DIR, "public", "sitemap_data.json")
REELS_PATH = os.path.join(BASE_DIR, "public", "reels_data.json")

print("🎬 开始提取解说视频...")

if not os.path.exists(SITEMAP_PATH):
    print("❌ sitemap_data.json 不存在")
    exit(1)

with open(SITEMAP_PATH, "r", encoding="utf-8") as f:
    all_data = json.load(f)

print(f"📊 总共 {len(all_data)} 个视频")

# 提取解说视频
reels_list = []
for item in all_data:
    title = item.get("title", "")
    category = item.get("category", "")
    if "解说" in title or "解说" in category:
        reels_list.append(item)

print(f"🎯 找到 {len(reels_list)} 个解说视频")

# 保存
with open(REELS_PATH, "w", encoding="utf-8") as f:
    json.dump(reels_list, f, ensure_ascii=False, indent=2)

print(f"✅ 已保存到 {REELS_PATH}")
