from fastapi import FastAPI, Query, Header, HTTPException, Body, Request
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

# 内存缓存，大幅提升分页速度
_DATA_CACHE = {"items": [], "time": 0}

def get_full_data():
    now = time.time()
    if not _DATA_CACHE["items"] or (now - _DATA_CACHE["time"] > 300):
        if os.path.exists(SITEMAP_DATA):
            try:
                with open(SITEMAP_DATA, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                    # 按更新时间倒序
                    raw.sort(key=lambda x: str(x.get("update_time", "0")), reverse=True)
                    _DATA_CACHE["items"] = raw
                    _DATA_CACHE["time"] = now
                    print(f"🌚 [CACHE_LOAD] 已加载 {len(raw)} 条全量数据")
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
def search(request: Request, q: str = Query(None), t: str = Query(None), pg: int = Query(1)):
    # 路径 A：频道/分类浏览 -> 走本地库
    if t and not q:
        all_data = get_full_data()
        filtered = []
        seen = set()
        for item in all_data:
            cat = str(item.get("category", ""))
            title = str(item.get("title", ""))
            if f"{title}_{cat}" in seen: continue
            
            match = False
            if t == "短剧" and ("短剧" in cat or "短剧" in title): match = True
            elif t == "电视剧" and ("剧" in cat or "电视" in cat) and "短剧" not in cat and "短剧" not in title: match = True
            elif t == "动漫" and ("动漫" in cat or "动画" in cat): match = True
            elif t == "电影" and ("电影" in cat or "片" in cat): match = True
            elif t in cat: match = True
            
            if match:
                new_item = item.copy()
                new_item["source_name"] = item.get("source", "默认")
                new_item["source_tip"] = item.get("tip", "高清")
                filtered.append(new_item)
                seen.add(f"{title}_{cat}")
        
        page_size = 30
        start = (pg - 1) * page_size
        results = filtered[start:start+page_size]
        print(f"✅ [API] {t} Pg:{pg} Count:{len(results)}")
        return results

    # 路径 B：关键词搜索
    sources = get_active_sources()
    if q: track_search(q)
    unique_results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(sources))) as executor:
        futures = [executor.submit(fetch_single_page, eng, keyword=q, pg=pg) for eng in sources]
        for future in concurrent.futures.as_completed(futures):
            for item in future.result():
                if item['title'] not in unique_results:
                    unique_results[item['title']] = item
    return list(unique_results.values())

@app.get("/api/latest")
def get_latest():
    data = get_full_data()
    if data:
        results = data[:12]
        for item in results:
            item["source_name"] = item.get("source", "默认")
            item["source_tip"] = item.get("tip", "高清")
        return results
    return []

@app.get("/api/config")
def get_public_config():
    cfg = load_json(CONFIG_FILE, {})
    return {"site_name": cfg.get("site_name", "🐾 小黑搜影"), "notice": cfg.get("notice", ""), "footer": cfg.get("footer", "© 2026")}

@app.get("/api/detail")
def get_detail(id: str, src: str):
    sources = get_active_sources()
    engine = next((e for e in sources if e["name"] == urllib.parse.unquote(src)), sources[0] if sources else None)
    if not engine: return None
    try:
        res = requests.get(f"{engine['api']}?ac=detail&ids={id}", timeout=5).json()
        if res.get("list"):
            item = res["list"][0]
            play_url = item.get("vod_play_url", "")
            ep_list = []
            if play_url:
                for p in play_url.replace('\r', '').split('#'):
                    if "$" in p:
                        try:
                            n, u = p.split("$", 1)
                            if ".m3u8" in u.lower() or ".mp4" in u.lower(): ep_list.append({"name": n, "url": u})
                        except: continue
            return {"title": item["vod_name"], "poster": item["vod_pic"], "category": item["type_name"], "description": item["vod_content"], "episodes": ep_list}
    except: pass
    return None

@app.get("/api/admin/collector-status")
def get_collector_status(x_admin_token: str = Header(None)):
    verify_admin(x_admin_token)
    return {"stats": {"total": len(get_full_data())}}

@app.post("/api/admin/trigger-collector")
def trigger_collector(x_admin_token: str = Header(None)):
    verify_admin(x_admin_token)
    subprocess.Popen([sys.executable, "build_sitemap_data.py"])
    return {"status": "success"}

@app.get("/api/sitemap-info")
def get_sitemap_info():
    return {"total": len(get_full_data()), "chunk_size": 5000}

@app.get("/api/sitemap-raw")
def get_sitemap_raw(chunk: int = Query(None)):
    data = get_full_data()
    if chunk is None or chunk == 0: return data[:2000]
    s = (chunk - 1) * 5000
    return data[s:s+5000]

@app.on_event("startup")
async def startup_event():
    subprocess.Popen([sys.executable, "build_sitemap_data.py"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
