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
from db import get_db, init_db

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

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}

def fetch_single_page(engine, type_id=None, keyword=None, pg=1):
    try:
        api_url = f"{engine['api']}?ac=detail&pg={pg}"
        if type_id: api_url += f"&t={type_id}"
        if keyword: api_url += f"&wd={urllib.parse.quote(keyword)}"
        res = requests.get(api_url, timeout=8, headers=HEADERS)
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

@app.get("/api/sitemap-raw")
def get_sitemap_raw(page_size: int = Query(1000), chunk: int = Query(0)):
    conn = get_db()
    conn.row_factory = lambda cursor, row: {col[0]: row[idx] for idx, col in enumerate(cursor.description)}
    cursor = conn.cursor()
    
    # 按照 chunk 索引直接分页，从 0 开始
    limit = page_size
    offset = chunk * page_size
    
    # 增加 ORDER BY id 确保分页结果不跳变
    cursor.execute("SELECT id, vod_id, title, category, update_time FROM movies ORDER BY id LIMIT ? OFFSET ?", (limit, offset))
    rows = cursor.fetchall()
    results = [dict(r) for r in rows]
    conn.close()
    return results

def track_search(q):
    if not q: return
    trends = load_json(TRENDS_FILE, {})
    trends[q] = trends.get(q, 0) + 1
    sorted_trends = dict(sorted(trends.items(), key=lambda item: item[1], reverse=True)[:100])
    save_json(TRENDS_FILE, sorted_trends)

@app.get("/api/search")
def search(q: str = Query(None), t: str = Query(None), class_tag: str = Query(None), pg: int = Query(1)):
    if t and not q:
        conn = get_db()
        conn.row_factory = lambda cursor, row: {col[0]: row[idx] for idx, col in enumerate(cursor.description)}
        cursor = conn.cursor()
        
        query = "SELECT * FROM movies WHERE 1=1"
        params = []
        
        if t == "短剧":
            query += " AND (category LIKE '%短剧%' OR title LIKE '%短剧%')"
        elif t == "电视剧":
            query += " AND (category LIKE '%剧%' OR category LIKE '%电视%') AND category NOT LIKE '%短剧%' AND title NOT LIKE '%短剧%' AND category NOT LIKE '%解说%'"
        elif t == "动漫":
            query += " AND (category LIKE '%动漫%' OR category LIKE '%动画%') AND category NOT LIKE '%解说%'"
        elif t == "电影":
            query += " AND (category LIKE '%电影%' OR category LIKE '%片%') AND category NOT LIKE '%解说%'"
        else:
            query += " AND category = ?"
            params.append(t)
            
        if class_tag:
            query += " AND category = ?"
            params.append(class_tag)
            
        query += " ORDER BY update_time DESC LIMIT ? OFFSET ?"
        page_size = 36
        params.extend([page_size, (pg - 1) * page_size])
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        results = []
        for row in rows:
            item = dict(row)
            item["source_tip"] = "高清"
            item["episodes"] = json.loads(item["episodes"]) if item["episodes"] else []
            results.append(item)
            
        conn.close()
        return results

    sources = get_active_sources()
    if q: track_search(q)
    # 实时搜索逻辑保持不变
    unique_results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(sources))) as executor:
        futures = [executor.submit(fetch_single_page, eng, keyword=q, pg=pg) for eng in sources]
        for future in concurrent.futures.as_completed(futures):
            for item in future.result():
                if item['title'] not in unique_results:
                    unique_results[item['title']] = item
    return list(unique_results.values())

@app.get("/api/categories")
def get_categories(t: str = Query(...)):
    conn = get_db()
    cursor = conn.cursor()
    
    query = "SELECT DISTINCT category FROM movies WHERE 1=1"
    params = []
    
    if t == "短剧":
        query += " AND (category LIKE '%短剧%' OR title LIKE '%短剧%')"
    elif t == "电视剧":
        query += " AND (category LIKE '%剧%' OR category LIKE '%电视%') AND category NOT LIKE '%短剧%'"
    elif t == "动漫":
        query += " AND (category LIKE '%动漫%' OR category LIKE '%动画%')"
    elif t == "电影":
        # 宽泛匹配电影分类，包含蓝光等
        query += " AND (category LIKE '%电影%' OR category LIKE '%片%' OR category LIKE '%蓝光%')"
    else:
        query += " AND category LIKE ?"
        params.append(f"%{t}%")
        
    cursor.execute(query, params)
    cats = [row[0] for row in cursor.fetchall() if row[0]]
    conn.close()
    
    # 彻底忽略掉的无意义标签
    ignored_keywords = ["说明", "测试", "福利", "其它", "解说"]
    
    # 返回所有标签（包含伦理，由前端决定折叠显示）
    filtered_cats = [c for c in cats if not any(k in c for k in ignored_keywords)]
    
    # 排序逻辑：将敏感分类排在最后
    sensitive_keywords = ["伦理", "成人", "色情", "写真", "福利"]
    
    def sort_key(cat):
        is_sensitive = any(k in cat for k in sensitive_keywords)
        return (1 if is_sensitive else 0, cat)
    
    return sorted(filtered_cats, key=sort_key)

@app.get("/api/reels")
def get_reels(pg: int = Query(1)):
    conn = get_db()
    conn.row_factory = lambda cursor, row: {col[0]: row[idx] for idx, col in enumerate(cursor.description)}
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM movies WHERE title LIKE '%解说%' OR category LIKE '%解说%' ORDER BY update_time DESC LIMIT ? OFFSET ?", (30, (pg-1)*30))
    rows = cursor.fetchall()
    results = []
    for row in rows:
        item = dict(row)
        item["episodes"] = json.loads(item["episodes"]) if item["episodes"] else []
        results.append(item)
    conn.close()
    return results

@app.get("/api/latest")
def get_latest():
    conn = get_db()
    conn.row_factory = lambda cursor, row: {col[0]: row[idx] for idx, col in enumerate(cursor.description)}
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM movies ORDER BY update_time DESC LIMIT 12")
    rows = cursor.fetchall()
    results = []
    for row in rows:
        item = dict(row)
        item["source_tip"] = "高清"
        item["episodes"] = json.loads(item["episodes"]) if item["episodes"] else []
        results.append(item)
    conn.close()
    return results

@app.get("/api/config")
def get_public_config():
    cfg = load_json(CONFIG_FILE, {})
    return {
        "site_name": cfg.get("site_name", "🐾 小黑搜影"), 
        "notice": cfg.get("notice", ""), 
        "footer": cfg.get("footer", "© 2026"),
        "theme": cfg.get("theme", "")
    }

@app.get("/api/detail")
def get_detail(id: str, src: str):
    sources = get_active_sources()
    engine = next((e for e in sources if e["name"] == urllib.parse.unquote(src)), sources[0] if sources else None)
    
    # 先尝试从实时API获取
    if engine:
        try:
            res = requests.get(f"{engine['api']}?ac=detail&ids={id}", timeout=5, headers=HEADERS).json()
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
                return {"title": item["vod_name"], "poster": item["vod_pic"], "category": item.get("type_name", ""), "description": item.get("vod_content", ""), "episodes": ep_list, "year": item.get("vod_year", ""), "area": item.get("vod_area", "")}
        except: pass
    
    conn = get_db()
    conn.row_factory = lambda cursor, row: {col[0]: row[idx] for idx, col in enumerate(cursor.description)}
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM movies WHERE vod_id = ?", (id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        item = dict(row)
        return {
            "title": item["title"],
            "poster": item["poster"],
            "category": item["category"],
            "description": item["description"],
            "episodes": json.loads(item["episodes"]) if item["episodes"] else [],
            "year": item["year"],
            "area": ""
        }
    return None

# --- 管理接口 ---

@app.get("/api/admin/collector-status")
def get_collector_status(x_admin_token: str = Header(None)):
    verify_admin(x_admin_token)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    log_path = os.path.join(base_dir, "collector.log")
    db_path = os.path.join(base_dir, "data.db")
    log_content = ""
    if os.path.exists(log_path):
        try:
            with open(log_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
                log_content = "".join(lines[-100:])
        except: pass
    
    conn = get_db()
    count = conn.execute("SELECT count(*) FROM movies").fetchone()[0]
    conn.close()
    
    data_stats = {"total": count, "size": f"{os.stat(db_path).st_size/1024/1024:.2f} MB" if os.path.exists(db_path) else "0 MB"}
    return {"log": log_content, "stats": data_stats}

@app.get("/api/admin/stats")
def get_admin_stats(x_admin_token: str = Header(None)):
    verify_admin(x_admin_token)
    conn = get_db()
    cursor = conn.cursor()
    
    # 总数
    total = conn.execute("SELECT count(*) FROM movies").fetchone()[0]
    
    # 【动态分类】直接从数据库中统计所有出现过的分类名称
    cursor.execute("SELECT category, COUNT(*) as count FROM movies GROUP BY category ORDER BY count DESC")
    rows = cursor.fetchall()
    
    # 转换为字典格式返回
    cats = {row[0]: row[1] for row in rows}
    
    conn.close()
    return {
        "total": total,
        "categories": cats,
        "lastUpdate": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    }

@app.post("/api/admin/trigger-collector")
def trigger_collector(x_admin_token: str = Header(None)):
    verify_admin(x_admin_token)
    subprocess.Popen([sys.executable, "build_sitemap_data.py"])
    return {"status": "success"}

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

@app.post("/api/admin/test-source")
def test_source(data: dict = Body(...), x_admin_token: str = Header(None)):
    verify_admin(x_admin_token)
    api_url = data.get("api")
    if not api_url:
        return {"status": "error", "message": "Missing API URL"}
    
    start_time = time.time()
    try:
        # 尝试获取第一页数据，测试连通性
        test_url = f"{api_url}?ac=list&pg=1"
        res = requests.get(test_url, timeout=10, headers=HEADERS)
        latency = round((time.time() - start_time) * 1000, 2)
        
        if res.status_code == 200:
            try:
                json_data = res.json()
                item_count = len(json_data.get("list", []))
                return {
                    "status": "success", 
                    "latency": f"{latency}ms", 
                    "message": f"连接成功，吐出 {item_count} 条数据"
                }
            except:
                return {"status": "error", "message": "解析 JSON 失败，可能非标准接口"}
        else:
            return {"status": "error", "message": f"请求失败，状态码: {res.status_code}"}
    except Exception as e:
        return {"status": "error", "message": f"连接超时或失败: {str(e)}"}

@app.get("/api/sitemap-info")
def get_sitemap_info():
    conn = get_db()
    count = conn.execute("SELECT count(*) FROM movies").fetchone()[0]
    conn.close()
    return {"total": count, "chunk_size": 5000}

@app.get("/api/sitemap-raw")
def get_sitemap_raw(chunk: int = Query(0)):
    conn = get_db()
    conn.row_factory = lambda cursor, row: {col[0]: row[idx] for idx, col in enumerate(cursor.description)}
    cursor = conn.cursor()
    page_size = 5000
    
    # 按照 chunk 索引直接分页，从 0 开始
    limit = page_size
    offset = chunk * page_size
    
    # 增加 ORDER BY id 确保分页结果不跳变
    cursor.execute("SELECT id, vod_id, title, category, update_time FROM movies ORDER BY id LIMIT ? OFFSET ?", (limit, offset))
    rows = cursor.fetchall()
    results = [dict(r) for r in rows]
    conn.close()
    return results

@app.get("/api/search")
def search_movies(q: str = Query(None), t: str = Query(None), pg: int = Query(1)):
    conn = get_db()
    conn.row_factory = lambda cursor, row: {col[0]: row[idx] for idx, col in enumerate(cursor.description)}
    cursor = conn.cursor()
    
    page_size = 30
    offset = (pg - 1) * page_size
    
    where_clauses = []
    params = []
    
    if q:
        where_clauses.append("(title LIKE ? OR description LIKE ?)")
        params.extend([f"%{q}%", f"%{q}%"])
    
    if t:
        if t == "电影":
            where_clauses.append("(category LIKE '%电影%' OR category LIKE '%片%' OR category LIKE '%蓝光%') AND category NOT LIKE '%解说%'")
        elif t == "电视剧":
            where_clauses.append("(category LIKE '%剧%' OR category LIKE '%连续剧%' OR category LIKE '%电视%') AND category NOT LIKE '%短剧%' AND category NOT LIKE '%解说%'")
        elif t == "动漫":
            where_clauses.append("(category LIKE '%动漫%' OR category LIKE '%动画%' OR category LIKE '%番剧%') AND category NOT LIKE '%解说%'")
        elif t == "综艺":
            where_clauses.append("(category LIKE '%综艺%' OR category LIKE '%晚会%') AND category NOT LIKE '%解说%'")
        elif t == "其他":
            where_clauses.append("category NOT LIKE '%电影%' AND category NOT LIKE '%片%' AND category NOT LIKE '%剧%' AND category NOT LIKE '%动漫%' AND category NOT LIKE '%综艺%'")
        else:
            where_clauses.append("category = ?")
            params.append(t)
    
    where_sql = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""
    query = f"SELECT * FROM movies {where_sql} ORDER BY update_time DESC LIMIT ? OFFSET ?"
    params.extend([page_size, offset])
    
    cursor.execute(query, tuple(params))
    items = cursor.fetchall()
    conn.close()
    return [dict(i) for i in items]

@app.on_event("startup")
async def startup_event():
    init_db()
    subprocess.Popen([sys.executable, "build_sitemap_data.py", "--daemon"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
