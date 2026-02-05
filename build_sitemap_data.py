import requests
import json
import time
import os
import concurrent.futures
from urllib.parse import quote

# 资源配置
SOURCES = [
    {"name": "量子高清", "api": "https://cj.lziapi.com/api.php/provide/vod/from/lzm3u8/at/json/"},
    {"name": "飞飞资源", "api": "https://www.ffzyapi.com/api.php/provide/vod/from/ffm3u8/at/json/"},
    {"name": "红牛专线", "api": "https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/"},
    {"name": "索尼资源", "api": "https://suoniapi.com/api.php/provide/vod/from/snm3u8/at/json/"}
]

# 保存路径
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAVE_PATH = os.path.join(BASE_DIR, "public", "sitemap_data.json")

def log(msg):
    log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "collector.log")
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(f"{msg}\n")
        f.flush()

def fetch_page(engine, page):
    """Fetch latest data using ac=detail"""
    try:
        api_url = f"{engine['api']}?ac=detail&pg={page}"
        res = requests.get(api_url, timeout=10)
        data = res.json()
        return data.get("list", [])
    except:
        return []

def run_collector(max_pages_per_source=1000):
    all_movies = {}
    log("--- Starting Full Collection (Optimized) ---")
    
    for idx, engine in enumerate(SOURCES):
        log(f"Processing Source {idx}: {engine['name']}")
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
            for batch_start in range(1, max_pages_per_source + 1, 100):
                batch_end = min(batch_start + 100, max_pages_per_source + 1)
                log(f"  Fetching pages {batch_start} to {batch_end-1}...")
                
                futures = [executor.submit(fetch_page, engine, p) for p in range(batch_start, batch_end)]
                
                source_new_count = 0
                for future in concurrent.futures.as_completed(futures):
                    items = future.result()
                    for item in items:
                        title = item.get("vod_name")
                        vod_id = item.get("vod_id")
                        if title and vod_id:
                            if title not in all_movies:
                                all_movies[title] = {
                                    "id": str(vod_id),
                                    "title": title,
                                    "source": engine['name'],
                                    "category": item.get("type_name", "影视"), # 增加分类信息
                                    "update_time": item.get("vod_time")
                                }
                                source_new_count += 1
                log(f"    Added {source_new_count} new unique items in this batch.")
                time.sleep(0.5)
                
        log(f"Current total unique items: {len(all_movies)}")

    movie_list = list(all_movies.values())
    try:
        movie_list.sort(key=lambda x: x.get('update_time', ''), reverse=True)
    except:
        pass

    os.makedirs(os.path.dirname(SAVE_PATH), exist_ok=True)
    with open(SAVE_PATH, "w", encoding="utf-8") as f:
        json.dump(movie_list, f, ensure_ascii=False, indent=2)
    
    log(f"Done! Final unique items: {len(movie_list)}")
    log(f"File saved to: {SAVE_PATH}")

if __name__ == "__main__":
    run_collector(max_pages_per_source=1000)
