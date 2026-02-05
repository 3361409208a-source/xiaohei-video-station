from fastapi import FastAPI, Query, Header, HTTPException, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import requests
import os
import json
from bs4 import BeautifulSoup
import re
import urllib.parse
import sys
import io
import time
import concurrent.futures
import subprocess

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 文件路径配置
CONFIG_FILE = "config.json"
SOURCES_FILE = "sources.json"
TRENDS_FILE = "search_trends.json"
SITEMAP_DATA = "public/sitemap_data.json"
ADMIN_PASSWORD = "7897"

def load_json(path, default):
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except: pass
    return default

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_active_sources():
    sources = load_json(SOURCES_FILE, [])
    return [s for s in sources if s.get("active", True)]

def verify_admin(x_admin_token: str = Header(None)):
    if x_admin_token != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Unauthorized")

# 缓存全量数据，减少磁盘 IO
_DATA_CACHE = {"items": [], "time": 0}

def get_full_data():
    now = time.time()
    if not _DATA_CACHE["items"] or (now - _DATA_CACHE["time"] > 300):
        if os.path.exists(SITEMAP_DATA):
            try:
                with open(SITEMAP_DATA, "r", encoding="utf-8") as f:
                    _DATA_CACHE["items"] = json.load(f)
                    _DATA_CACHE["time"] = now
                    print(f"🌚 [CACHE_LOAD] Loaded {len(_DATA_CACHE['items'])} items")
            except: pass
    return _DATA_CACHE["items"]

def fetch_single_page(engine, type_id=None, keyword=None, pg=1):
    try:
        api_url = f"{engine['api']}?ac=detail&pg={pg}"
        if type_id: api_url += f"&t={type_id}"
        if keyword: api_url += f"&wd={urllib.parse.quote(keyword)}"
        res = requests.get(api_url, timeout=8)
        res.encoding = 'utf-8'
        data = res.json()
        results = []
        if data.get("list"):
            for item in data["list"]:
                results.append(parse_item(item, engine))
        return results
    except: return []

def parse_item(item, engine):
    play_url_raw = item.get("vod_play_url", "")
    ep_list = []
    if play_url_raw:
        parts = play_url_raw.replace('\r', '').split("#")
        for p in parts:
            if "$" in p:
                try:
                    name, url = p.split("$", 1)
                    if any(ext in url.lower() for ext in [".m3u8", ".mp4"]):
                        ep_list.append({"name": name, "url": url})
                except: continue
    return {
        "id": str(item["vod_id"]),
        "title": item["vod_name"],
        "category": item.get("type_name", "影视"),
        "poster": item.get("vod_pic", ""),
        "director": item.get("vod_director", ""),
        "actor": item.get("vod_actor", ""),
        "year": item.get("vod_year", ""),
        "area": item.get("vod_area", ""),
        "remark": item.get("vod_remarks", ""),
        "description": item.get("vod_content", "").replace('<p>', '').replace('</p>', '').replace('<br>', '\n'),
        "episodes": ep_list,
        "source_name": engine["name"],
        "source_tip": engine.get("tip", "极速")
    }

def track_search(q):
    if not q: return
    trends = load_json(TRENDS_FILE, {})
    trends[q] = trends.get(q, 0) + 1
    sorted_trends = dict(sorted(trends.items(), key=lambda item: item[1], reverse=True)[:100])
    save_json(TRENDS_FILE, sorted_trends)

@app.get("/api/search")
def search(q: str = Query(None), t: str = Query(None), pg: int = Query(1)):
    print(f"🌚 [DEBUG] REQUEST RECEIVED: t={t}, q={q}, pg={pg}")
    
    # 路径 A：频道/分类浏览 -> 强制走本地缓存库
    if t and not q:
        all_data = get_full_data()
        if not all_data:
            print("🌚 [WARN] No cached data available")
            return []
        
        filtered = []
        seen_titles = set()
        
        for item in all_data:
            cat = str(item.get("category", ""))
            title = str(item.get("title", ""))
            
            # 基础去重
            unique_key = f"{title}_{cat}"
            if unique_key in seen_titles: continue
            
            is_match = False
            # 强化分类逻辑
            if t == "短剧":
                if "短剧" in cat or "短剧" in title: is_match = True
            elif t == "电视剧":
                # 排除掉短剧，剩下的带“剧”字或“电视”的归入电视剧
                if ("剧" in cat or "电视" in cat) and "短剧" not in cat and "短剧" not in title:
                    is_match = True
            elif t == "动漫":
                if "动漫" in cat or "动画" in cat: is_match = True
            elif t == "电影":
                if "电影" in cat or "片" in cat: is_match = True
            elif t in cat:
                is_match = True
            
            if is_match:
                # 显式拷贝并补齐字段
                new_item = item.copy()
                new_item["source_name"] = item.get("source", "默认源")
                new_item["source_tip"] = item.get("tip", "高清")
                filtered.append(new_item)
                seen_titles.add(unique_key)
        
        # 精准物理分页
        page_size = 30
        start = (pg - 1) * page_size
        end = start + page_size
        results = filtered[start:end]
        
        print(f"✅ [CHANNEL] {t} Pg:{pg} Range:{start}-{end} ResultsCount:{len(results)}")
        
        return JSONResponse(content=results, headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        })

    # 路径 B：关键词搜索 -> 走实时聚合接口
    sources = get_active_sources()
    if q: track_search(q)
    
    unique_results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(sources))) as executor:
        futures = [executor.submit(fetch_single_page, eng, keyword=q, pg=pg) for eng in sources]
        for future in concurrent.futures.as_completed(futures):
            for item in future.result():
                key = item['title']
                if key not in unique_results:
                    unique_results[key] = item
    return list(unique_results.values())

@app.get("/api/latest")
def get_latest():
    # 首页推荐直接从本地库取前 12 个最新的
    data = get_full_data()
    if data:
        results = data[:12]
        for item in results:
            item["source_name"] = item.get("source", "默认源")
            item["source_tip"] = item.get("tip", "高清")
        return results
    return []

@app.get("/api/config")
def get_public_config():
    cfg = load_json(CONFIG_FILE, {})
    return {
        "site_name": cfg.get("site_name", "🐾 小黑搜影"),
        "notice": cfg.get("notice", ""),
        "footer": cfg.get("footer", "© 2026 小黑视频站")
    }

@app.get("/api/detail")
def get_detail(id: str, src: str):
    sources = get_active_sources()
    decoded_src = urllib.parse.unquote(src)
    engine = next((e for e in sources if e["name"] == decoded_src or e["name"] == src), None)
    if not engine: engine = sources[0] if sources else None
    if not engine: return None
    try:
        api_url = f"{engine['api']}?ac=detail&ids={id}"
        res = requests.get(api_url, timeout=5)
        res.encoding = res.apparent_encoding if res.apparent_encoding else 'utf-8'
        data = res.json()
        if data.get("list"):
            item = data["list"][0]
            play_url_raw = item.get("vod_play_url", "")
            ep_list = []
            if play_url_raw:
                lines = play_url_raw.replace('\r', '').split('#')
                for p in lines:
                    if "$" in p:
                        try:
                            name, url = p.split("$", 1)
                            if any(ext in url.lower() for ext in [".m3u8", ".mp4", ".flv", ".m4v"]):
                                ep_list.append({"name": name, "url": url})
                        except: continue
            return {
                "title": item.get("vod_name", "未知"),
                "poster": item.get("vod_pic", ""),
                "category": item.get("type_name", "影视"),
                "director": item.get("vod_director", ""),
                "actor": item.get("vod_actor", ""),
                "year": item.get("vod_year", ""),
                "area": item.get("vod_area", ""),
                "remark": item.get("vod_remarks", ""),
                "description": item.get("vod_content", "").replace('<p>', '').replace('</p>', '').replace('<br>', '\n').replace('&nbsp;', ' '),
                "episodes": ep_list
            }
    except: pass
    return None

@app.get("/api/admin/collector-status")
def get_collector_status(x_admin_token: str = Header(None)):
    verify_admin(x_admin_token)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    log_path = os.path.join(base_dir, "collector.log")
    data_path = os.path.join(base_dir, "public", "sitemap_data.json")
    log_content = ""
    if os.path.exists(log_path):
        try:
            with open(log_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
                log_content = "".join(lines[-100:])
        except: pass
    data_stats = {"total": 0, "size": "0 MB", "last_modified": "Never"}
    if os.path.exists(data_path):
        try:
            stats = os.stat(data_path)
            data_stats["size"] = f"{stats.st_size / 1024 / 1024:.2f} MB"
            data_stats["last_modified"] = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(stats.st_mtime))
            with open(data_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                data_stats["total"] = len(data)
        except: pass
    return {"log": log_content, "stats": data_stats}

@app.post("/api/admin/trigger-collector")
def trigger_collector(x_admin_token: str = Header(None)):
    verify_admin(x_admin_token)
    try:
        subprocess.Popen([sys.executable, "build_sitemap_data.py"])
        return {"status": "success", "message": "Collector started"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/admin/config")
def get_config(x_admin_token: str = Header(None)):
    verify_admin(x_admin_token)
    return load_json(CONFIG_FILE, {})

@app.post("/api/admin/config")
def save_config(data: dict = Body(...), x_admin_token: str = Header(None)):
    verify_admin(x_admin_token)
    save_json(CONFIG_FILE, data)
    return {"status": "success"}

@app.get("/api/admin/sources")
def get_sources(x_admin_token: str = Header(None)):
    verify_admin(x_admin_token)
    return load_json(SOURCES_FILE, [])

@app.post("/api/admin/sources")
def save_sources(data: list = Body(...), x_admin_token: str = Header(None)):
    verify_admin(x_admin_token)
    save_json(SOURCES_FILE, data)
    return {"status": "success"}

@app.get("/api/admin/trends")
def get_trends(x_admin_token: str = Header(None)):
    verify_admin(x_admin_token)
    return load_json(TRENDS_FILE, {})

@app.get("/api/sitemap-info")
def get_sitemap_info():
    data = get_full_data()
    return {"total": len(data), "chunk_size": 5000}

@app.get("/api/sitemap-raw")
def get_sitemap_raw(chunk: int = Query(None)):
    all_data = get_full_data()
    if not all_data: return []
    if chunk is None: return all_data[:2000]
    if chunk == 0: return all_data[:2000]
    start = (chunk - 1) * 5000
    end = start + 5000
    return all_data[start:end]

@app.on_event("startup")
async def startup_event():
    print("🌚 大神提醒：服务已启动，正在后台自动同步 5 万条全量索引...")
    try:
        subprocess.Popen([sys.executable, "build_sitemap_data.py"])
    except Exception as e:
        print(f"Startup collector failed: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
