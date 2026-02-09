import requests
import json
import time
import os
import concurrent.futures
from urllib.parse import quote
import threading

# 保存路径
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAVE_PATH = os.path.join(BASE_DIR, "public", "sitemap_data.json")
REELS_PATH = os.path.join(BASE_DIR, "public", "reels_data.json")  # 新增：解说视频专用文件
SOURCES_FILE = os.path.join(BASE_DIR, "sources.json")

def log(msg):
    log_path = os.path.join(BASE_DIR, "collector.log")
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(f"{msg}\n")
        f.flush()

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}

def fetch_page(engine, page):
    try:
        api_url = f"{engine['api']}?ac=detail&pg={page}"
        res = requests.get(api_url, timeout=10, headers=HEADERS)
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
                                    "year": item.get("vod_year", ""),
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

    # 分离解说视频
    reels_list = []
    for item in movie_list:
        title = item.get("title", "")
        category = item.get("category", "")
        if "解说" in title or "解说" in category:
            reels_list.append(item)
    
    log(f"Extracted {len(reels_list)} reels from {len(movie_list)} total items")

    # 保存完整数据
    os.makedirs(os.path.dirname(SAVE_PATH), exist_ok=True)
    with open(SAVE_PATH, "w", encoding="utf-8") as f:
        json.dump(movie_list, f, ensure_ascii=False, indent=2)
    
    # 保存解说视频数据
    with open(REELS_PATH, "w", encoding="utf-8") as f:
        json.dump(reels_list, f, ensure_ascii=False, indent=2)
    
    log(f"Done! Total: {len(movie_list)} items, Reels: {len(reels_list)} items")

def run_periodic_collector(interval_hours=6):
    """定期运行采集器"""
    while True:
        try:
            log(f"=== Periodic Collection Started (Every {interval_hours}h) ===")
            run_collector(max_pages_per_source=5000)
            log(f"=== Sleeping for {interval_hours} hours ===")
            time.sleep(interval_hours * 3600)
        except Exception as e:
            log(f"Error in periodic collector: {e}")
            time.sleep(300)  # 出错后等5分钟重试

if __name__ == "__main__":
    # 检查是否作为后台服务运行
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--daemon":
        # 后台定期运行模式
        run_periodic_collector(interval_hours=6)
    else:
        # 单次运行模式
        run_collector(max_pages_per_source=5000)
