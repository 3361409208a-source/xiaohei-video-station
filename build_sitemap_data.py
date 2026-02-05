import requests
import json
import time
import os
import concurrent.futures
from urllib.parse import quote

# 保存路径
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAVE_PATH = os.path.join(BASE_DIR, "public", "sitemap_data.json")
SOURCES_FILE = os.path.join(BASE_DIR, "sources.json")

def log(msg):
    log_path = os.path.join(BASE_DIR, "collector.log")
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(f"{msg}\n")
        f.flush()

def fetch_page(engine, page):
    try:
        api_url = f"{engine['api']}?ac=detail&pg={page}"
        res = requests.get(api_url, timeout=10)
        data = res.json()
        return data.get("list", [])
    except:
        return []

def run_collector(max_pages_per_source=1000):
    # 动态加载源
    if os.path.exists(SOURCES_FILE):
        with open(SOURCES_FILE, "r", encoding="utf-8") as f:
            all_sources = json.load(f)
            sources = [s for s in all_sources if s.get("active", True)]
    else:
        log("Error: sources.json not found")
        return

    all_movies = {}
    log("--- Starting Dynamic Collection ---")
    
    for idx, engine in enumerate(sources):
        log(f"Processing Source: {engine['name']}")
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
            for batch_start in range(1, max_pages_per_source + 1, 100):
                batch_end = min(batch_start + 100, max_pages_per_source + 1)
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
                                    "poster": item.get("vod_pic", ""),
                                    "source": engine['name'],
                                    "category": item.get("type_name", "影视"),
                                    "update_time": item.get("vod_time")
                                }
                                source_new_count += 1
                log(f"  Batch done. Added {source_new_count} unique items.")
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

if __name__ == "__main__":
    run_collector(max_pages_per_source=1000)
