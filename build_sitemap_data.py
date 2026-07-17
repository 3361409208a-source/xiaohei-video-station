from db import init_db, save_movies, get_db
import requests
import json
import time
import os
import concurrent.futures
from urllib.parse import quote
import threading

# 保存路径
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 不再主要依赖这些 JSON 文件进行查询，但为了兼容性可以保留路径定义
SAVE_PATH = os.path.join(BASE_DIR, "public", "sitemap_data.json")
SOURCES_FILE = os.path.join(BASE_DIR, "sources.json")

def log(msg):
    log_path = os.path.join(BASE_DIR, "collector.log")
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(f"{msg}\n")
        f.flush()

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}

_http = requests.Session()
_http.trust_env = False

def fetch_page(engine, page):
    try:
        api_url = f"{engine['api']}?ac=detail&pg={page}"
        res = _http.get(api_url, timeout=10, headers=HEADERS)
        data = res.json()
        return data.get("list", [])
    except:
        return []

def run_collector(max_pages_per_source=1000):
    # 初始化数据库
    init_db()
    
    # 动态加载源
    if os.path.exists(SOURCES_FILE):
        with open(SOURCES_FILE, "r", encoding="utf-8") as f:
            all_sources = json.load(f)
            sources = [s for s in all_sources if s.get("active", True)]
    else:
        log("Error: sources.json not found")
        return

    log("--- Starting Incremental Collection to SQLite ---")
    
    for idx, engine in enumerate(sources):
        log(f"Processing Source: {engine['name']}")
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            for batch_start in range(1, max_pages_per_source + 1, 50):
                batch_end = min(batch_start + 50, max_pages_per_source + 1)
                futures = [executor.submit(fetch_page, engine, p) for p in range(batch_start, batch_end)]
                
                batch_movies = []
                for future in concurrent.futures.as_completed(futures):
                    items = future.result()
                    for item in items:
                        title = item.get("vod_name")
                        vod_id = item.get("vod_id")
                        if title and vod_id:
                            batch_movies.append({
                                "id": str(vod_id),
                                "title": title,
                                "poster": item.get("vod_pic", ""),
                                "source": engine['name'],
                                "category": item.get("type_name", "影视"),
                                "year": item.get("vod_year", ""),
                                "update_time": item.get("vod_time"),
                                "description": item.get("vod_content", ""),
                                "episodes": item.get("vod_play_url", "") # 传递原始播放字符串由db.py解析
                            })
                
                if batch_movies:
                    save_movies(batch_movies)
                    log(f"  Batch {batch_start}-{batch_end-1} done. Processed {len(batch_movies)} items.")
                
                time.sleep(0.2)
                
    log("Collection task finished successfully.")

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
            time.sleep(300)

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--daemon":
        run_periodic_collector(interval_hours=6)
    else:
        # 单次运行，可以设置较小的页数进行测试
        run_collector(max_pages_per_source=2000)
