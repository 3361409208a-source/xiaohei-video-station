from fastapi import FastAPI, Query, Header, HTTPException, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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

SUB_CATEGORIES = {
    "电影": [6, 7, 8, 9, 10, 11, 12, 20], 
    "电视剧": [13, 14, 15, 16, 21, 22, 23, 24], 
    "综艺": [25, 26, 27, 28],
    "动漫": [29, 30, 31, 32, 33]
}

def track_search(q):
    if not q: return
    trends = load_json(TRENDS_FILE, {})
    trends[q] = trends.get(q, 0) + 1
    sorted_trends = dict(sorted(trends.items(), key=lambda item: item[1], reverse=True)[:100])
    save_json(TRENDS_FILE, sorted_trends)

@app.get("/api/search")
def search(q: str = Query(None), t: str = Query(None), pg: int = Query(1)):
    # 核心修复：如果是分类查询，优先使用本地全量库
    if not q and t and os.path.exists(SITEMAP_DATA):
        try:
            with open(SITEMAP_DATA, "r", encoding="utf-8") as f:
                all_data = json.load(f)
            
            filtered = []
            for item in all_data:
                cat = item.get("category", "")
                # 兼容老的 JSON 格式并补齐字段
                if t in cat or (t == "电影" and "电影" in cat) or (t == "电视剧" and ("剧" in cat or "电视" in cat)):
                    # 确保前端需要的字段都存在
                    item["source_name"] = item.get("source", "默认源")
                    item["source_tip"] = item.get("tip", "高清")
                    filtered.append(item)
            
            page_size = 36
            start = (pg - 1) * page_size
            end = start + page_size
            return filtered[start:end]
        except: pass

    # 如果没有本地库或是在线搜索，走实时接口
    sources = get_active_sources()
    if q: track_search(q)
    
    unique_results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(sources))) as executor:
        # 注意：此处 fetch_single_page 的 pg 参数必须传递
        futures = [executor.submit(fetch_single_page, eng, type_id=None, keyword=q, pg=pg) for eng in sources]
        for future in concurrent.futures.as_completed(futures):
            for item in future.result():
                key = item['title']
                if key not in unique_results:
                    unique_results[key] = item
    return list(unique_results.values())

@app.get("/api/latest")
def get_latest():
    # 首页推荐直接从本地库取最新的
    if os.path.exists(SITEMAP_DATA):
        try:
            with open(SITEMAP_DATA, "r", encoding="utf-8") as f:
                data = json.load(f)
                results = data[:12]
                for item in results:
                    item["source_name"] = item.get("source", "默认源")
                    item["source_tip"] = item.get("tip", "高清")
                return results
        except: pass
    
    sources = get_active_sources()
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(sources)) as executor:
        futures = [executor.submit(fetch_single_page, eng, pg=1) for eng in sources]
        for future in concurrent.futures.as_completed(futures):
            results.extend(future.result())
    unique_results = {}
    for item in results:
        if item['title'] not in unique_results: unique_results[item['title']] = item
    return list(unique_results.values())[:12]

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
    """返回全量数据的统计信息，供 Next.js 计算分卷"""
    if os.path.exists(SITEMAP_DATA):
        try:
            with open(SITEMAP_DATA, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {"total": len(data), "chunk_size": 5000}
        except: pass
    return {"total": 0, "chunk_size": 5000}

@app.get("/api/sitemap-raw")
def get_sitemap_raw(chunk: int = Query(None)):
    """按需返回 Sitemap 原始数据，支持分页/分卷以节省带宽"""
    if not os.path.exists(SITEMAP_DATA):
        return []
        
    try:
        with open(SITEMAP_DATA, "r", encoding="utf-8") as f:
            all_data = json.load(f)
            
        if chunk is None:
            # 如果不传参数，返回前 2000 条作为最新卷
            return all_data[:2000]
        
        # 返回指定分卷（每卷 5000 条）
        if chunk == 0:
            return all_data[:2000]
            
        start = (chunk - 1) * 5000
        end = start + 5000
        return all_data[start:end]
    except:
        return []

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
