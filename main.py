from fastapi import FastAPI, Query, Header, HTTPException, Body, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse, Response
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
from typing import Optional
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
CATEGORY_RULES_FILE = "category_rules.json"
# 必须通过环境变量配置，禁止在源码中硬编码
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "").strip()

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

_category_rules_cache = None

def load_category_rules():
    global _category_rules_cache
    if _category_rules_cache is None:
        _category_rules_cache = load_json(CATEGORY_RULES_FILE, {"categories": {}, "major_map": []})
    return _category_rules_cache

def build_category_where(t):
    """根据 category_rules.json 生成 SQL WHERE 片段与参数，与 JS matchCategory 对齐。"""
    if not t:
        return "", []

    rules = load_category_rules().get("categories", {})
    rule = rules.get(t)

    if not rule:
        return " AND category = ?", [t]

    if rule.get("mode") == "other":
        clauses = []
        params = []
        for kw in rule.get("other_exclude", []):
            clauses.append("category NOT LIKE ?")
            params.append(f"%{kw}%")
        if not clauses:
            return "", []
        return " AND (" + " AND ".join(clauses) + ")", params

    include_parts = []
    params = []
    for kw in rule.get("include", []):
        include_parts.append("category LIKE ?")
        params.append(f"%{kw}%")
    for kw in rule.get("title_include", []):
        include_parts.append("title LIKE ?")
        params.append(f"%{kw}%")

    if not include_parts:
        return " AND category = ?", [t]

    sql = " AND (" + " OR ".join(include_parts) + ")"

    for kw in rule.get("exclude", []):
        sql += " AND category NOT LIKE ?"
        params.append(f"%{kw}%")
    for kw in rule.get("title_exclude", []):
        sql += " AND title NOT LIKE ?"
        params.append(f"%{kw}%")

    return sql, params

def map_to_major_category(category):
    if not category:
        return "电影"
    lower = category.lower()
    for entry in load_category_rules().get("major_map", []):
        for kw in entry.get("match", []):
            if kw.lower() in lower:
                return entry.get("major", category)
    return category

def get_active_sources():
    sources = load_json(SOURCES_FILE, [])
    return [s for s in sources if s.get("active", True)]

def verify_admin(x_admin_token: str = Header(None)):
    if not ADMIN_PASSWORD or not x_admin_token or x_admin_token != ADMIN_PASSWORD:
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

        where_sql, where_params = build_category_where(t)
        query += where_sql
        params.extend(where_params)
            
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
    # 实时搜索：按 title+source 去重，保留同片多源供换源
    unique_results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(sources))) as executor:
        futures = [executor.submit(fetch_single_page, eng, keyword=q, pg=pg) for eng in sources]
        for future in concurrent.futures.as_completed(futures):
            for item in future.result():
                key = f"{item.get('title', '')}::{item.get('source_name', '')}"
                if key not in unique_results:
                    unique_results[key] = item
    return list(unique_results.values())

@app.get("/api/categories")
def get_categories(t: str = Query(...)):
    conn = get_db()
    cursor = conn.cursor()
    
    query = "SELECT DISTINCT category FROM movies WHERE 1=1"
    params = []
    where_sql, where_params = build_category_where(t)
    query += where_sql
    params.extend(where_params)
        
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

def _public_private_traffic(cfg):
    pt = cfg.get("private_traffic") or {}
    return {
        "enabled": bool(pt.get("enabled")),
        "message": pt.get("message", ""),
        "telegram_url": pt.get("telegram_url", ""),
        "group_url": pt.get("group_url", ""),
        "wechat_hint": pt.get("wechat_hint", ""),
    }

def _public_invite(cfg):
    inv = cfg.get("invite") or {}
    return {
        "enabled": bool(inv.get("enabled")),
        "message": inv.get("message", "本站现已开启邀请访问，请输入邀请码进入"),
    }

@app.get("/api/config")
def get_public_config():
    cfg = load_json(CONFIG_FILE, {})
    return {
        "site_name": cfg.get("site_name", "🐾 小黑搜影"), 
        "notice": cfg.get("notice", ""), 
        "footer": cfg.get("footer", "© 2026"),
        "theme": cfg.get("theme", ""),
        "ads": cfg.get("ads", {"enabled": False, "slots": {}}),
        "private_traffic": _public_private_traffic(cfg),
        "invite": _public_invite(cfg),
    }

@app.get("/api/invite/status")
def invite_status():
    cfg = load_json(CONFIG_FILE, {})
    return _public_invite(cfg)

@app.post("/api/invite/verify")
def invite_verify(data: dict = Body(...)):
    code = (data.get("code") or "").strip()
    cfg = load_json(CONFIG_FILE, {})
    invite = cfg.get("invite") or {}
    if not invite.get("enabled"):
        return {"ok": True}
    codes = [str(c).strip() for c in invite.get("codes", []) if str(c).strip()]
    if code and code in codes:
        return {"ok": True}
    return {"ok": False, "message": "邀请码无效，请检查后重试"}

@app.get("/api/trends")
def get_public_trends(limit: int = Query(10)):
    trends = load_json(TRENDS_FILE, {})
    sorted_items = sorted(trends.items(), key=lambda item: item[1], reverse=True)[:max(1, min(limit, 50))]
    return [{"keyword": k, "count": v} for k, v in sorted_items]

def cleanup_storage(trends_keep: int = 50):
    trends = load_json(TRENDS_FILE, {})
    sorted_trends = dict(sorted(trends.items(), key=lambda item: item[1], reverse=True)[:trends_keep])
    save_json(TRENDS_FILE, sorted_trends)

    vacuumed = False
    try:
        conn = get_db()
        conn.execute("VACUUM")
        conn.close()
        vacuumed = True
    except Exception as e:
        print(f"[Cleanup] VACUUM failed: {e}")

    return {
        "status": "success",
        "trends_kept": len(sorted_trends),
        "vacuumed": vacuumed
    }

@app.post("/api/admin/cleanup")
def admin_cleanup(x_admin_token: str = Header(None)):
    verify_admin(x_admin_token)
    return cleanup_storage(50)

@app.get("/api/detail")
def get_detail(id: str, src: Optional[str] = Query(None)):
    conn = get_db()
    cursor = conn.cursor()
    
    # 解析来源名称
    decoded_src = urllib.parse.unquote(src or "") if src else ""
    if decoded_src == 'undefined':
        decoded_src = ""
        
    actual_vod_id = id
    actual_src = decoded_src
    
    # 修复 ID 空间冲突逻辑：
    # 1. 优先尝试按 (vod_id + source) 精准匹配（针对实时搜索结果点进来的情况）
    if decoded_src:
        cursor.execute("SELECT vod_id, source_name FROM movies WHERE vod_id = ? AND source_name = ?", (id, decoded_src))
        row = cursor.fetchone()
    else:
        row = None
    
    if not row:
        # 2. 如果没找到，再看它是否是数据库的主键 id（针对首页推荐位点进来的情况）
        cursor.execute("SELECT vod_id, source_name FROM movies WHERE id = ?", (id,))
        row = cursor.fetchone()
        # 增加校验：如果传了明确的来源但与数据库查出的不符，说明 ID 冲突，应忽略此记录
        if row and decoded_src and row[1] != decoded_src:
            row = None
            
        if row:
            actual_vod_id = str(row[0])
            actual_src = row[1]

    if not row and not decoded_src:
        # 3. SEO canonical 无 src：取该 vod_id 最新更新的源
        cursor.execute(
            "SELECT vod_id, source_name FROM movies WHERE vod_id = ? ORDER BY update_time DESC, id ASC LIMIT 1",
            (id,),
        )
        row = cursor.fetchone()
        if row:
            actual_vod_id = str(row[0])
            actual_src = row[1]
    
    conn.close()

    
    sources = get_active_sources()
    # 使用已经解析出的 actual_src 匹配源引擎
    engine = next((e for e in sources if e["name"] == actual_src), sources[0] if sources else None)

    
    # 优先从实时 API 获取（保证链接是最新的）
    if engine:
        try:
            res = requests.get(f"{engine['api']}?ac=detail&ids={actual_vod_id}", timeout=8, headers=HEADERS).json()
            if res.get("list"):
                item = res["list"][0]
                play_url = item.get("vod_play_url", "")
                ep_list = []
                if play_url:
                    for p in play_url.replace('\r', '').split('#'):
                        if "$" in p:
                            try:
                                n, u = p.split("$", 1)
                                if ".m3u8" in u.lower() or ".mp4" in u.lower():
                                    ep_list.append({"name": n, "url": u})
                            except: continue
                
                # 实时拉取成功后同步更新数据库，保持链接新鲜
                if ep_list:
                    try:
                        conn2 = get_db()
                        conn2.execute(
                            "UPDATE movies SET episodes = ?, update_time = ? WHERE vod_id = ? AND source_name = ?",
                            (json.dumps(ep_list, ensure_ascii=False), item.get("vod_time", ""), actual_vod_id, engine["name"])
                        )
                        conn2.commit()
                        conn2.close()
                    except Exception as ue:
                        print(f"[Detail] DB sync failed: {ue}")

                return {
                    "vod_id": actual_vod_id,
                    "title": item["vod_name"],
                    "poster": item["vod_pic"],
                    "category": item.get("type_name", ""),
                    "description": item.get("vod_content", ""),
                    "episodes": ep_list,
                    "year": item.get("vod_year", ""),
                    "area": item.get("vod_area", ""),
                    "actor": item.get("vod_actor", ""),
                    "remark": item.get("vod_remarks", ""),
                    "source_name": engine["name"]
                }
        except Exception as e:
            print(f"[Detail] 实时拉取失败 vod_id={actual_vod_id} src={actual_src}: {e}")
    
    conn = get_db()
    conn.row_factory = lambda cursor, row: {col[0]: row[idx] for idx, col in enumerate(cursor.description)}
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM movies WHERE vod_id = ?", (actual_vod_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        item = dict(row)
        return {
            "vod_id": item.get("vod_id", actual_vod_id),
            "title": item["title"],
            "poster": item.get("poster", ""),
            "category": item.get("category", ""),
            "description": item.get("description", ""),
            "episodes": json.loads(item["episodes"]) if item.get("episodes") else [],
            "year": item.get("year", ""),
            "area": "",
            "actor": "",
            "remark": "",
            "source_name": item.get("source_name", actual_src),
            "_from_cache": True  # 标记此为缓存数据，链接可能已过期
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

def _movie_stats():
    conn = get_db()
    cursor = conn.cursor()
    total = conn.execute("SELECT count(*) FROM movies").fetchone()[0]
    cursor.execute("SELECT category, COUNT(*) as count FROM movies GROUP BY category ORDER BY count DESC")
    rows = cursor.fetchall()
    cats = {row[0]: row[1] for row in rows}
    conn.close()
    return {
        "total": total,
        "categories": cats,
        "lastUpdate": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    }

@app.get("/api/stats")
def get_public_stats():
    """首页星空大屏等公开展示用，不含敏感信息"""
    return _movie_stats()

@app.get("/api/admin/stats")
def get_admin_stats(x_admin_token: str = Header(None)):
    verify_admin(x_admin_token)
    return _movie_stats()

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

SITEMAP_CHUNK_SIZE = 5000

SITEMAP_QUALITY_WHERE = """
    length(trim(title)) >= 2
    AND poster IS NOT NULL AND trim(poster) != ''
    AND episodes IS NOT NULL AND trim(episodes) != '' AND trim(episodes) != '[]'
"""

SITEMAP_DEDUP_IDS = f"""
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY title ORDER BY update_time DESC, id ASC) AS rn
        FROM movies
        WHERE {SITEMAP_QUALITY_WHERE}
    ) WHERE rn = 1
"""

def _sitemap_total(conn):
    return conn.execute(f"SELECT COUNT(*) FROM movies WHERE id IN ({SITEMAP_DEDUP_IDS})").fetchone()[0]

def _fetch_sitemap_rows(conn, offset: int, limit: int):
    conn.row_factory = lambda cursor, row: {col[0]: row[idx] for idx, col in enumerate(cursor.description)}
    cursor = conn.cursor()
    cursor.execute(
        f"""
        SELECT id, vod_id, title, category, source_name, update_time, poster, year, description
        FROM movies
        WHERE id IN ({SITEMAP_DEDUP_IDS})
        ORDER BY update_time DESC, id ASC
        LIMIT ? OFFSET ?
        """,
        (limit, offset),
    )
    return [dict(r) for r in cursor.fetchall()]

@app.get("/api/sitemap-info")
def get_sitemap_info():
    conn = get_db()
    deduped = _sitemap_total(conn)
    raw = conn.execute("SELECT count(*) FROM movies").fetchone()[0]
    conn.close()
    return {
        "total": deduped,
        "raw_total": raw,
        "chunk_size": SITEMAP_CHUNK_SIZE,
        "deduped": True,
    }

@app.get("/api/sitemap-raw")
def get_sitemap_raw(chunk: int = Query(0)):
    conn = get_db()
    offset = chunk * SITEMAP_CHUNK_SIZE
    results = _fetch_sitemap_rows(conn, offset, SITEMAP_CHUNK_SIZE)
    conn.close()
    return results

# ==================== 视频代理接口 ====================
# 解决视频 CDN 防盗链 403 问题
# 服务端不带 Referer 去请求视频，前端通过此接口播放

PROXY_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    # 故意不设置 Referer，防盗链服务器就看不到你的站点域名
}

def is_safe_proxy_url(raw_url: str):
    """与 Next proxySafety.js 对齐的 SSRF 防护"""
    if not raw_url:
        return False, "Missing url"
    try:
        parsed = urllib.parse.urlparse(raw_url)
    except Exception:
        return False, "Invalid url"
    if parsed.scheme not in ("http", "https"):
        return False, "Only http/https allowed"
    host = (parsed.hostname or "").lower()
    if not host:
        return False, "Invalid host"
    if host in ("localhost", "metadata.google.internal") or host.endswith(".localhost"):
        return False, "Blocked host"
    if host in ("::1",) or host.startswith("fe80:") or host.startswith("fc") or host.startswith("fd"):
        return False, "Blocked IPv6 address"
    # IPv4 私网 / 本机 / link-local / CGNAT
    parts = host.split(".")
    if len(parts) == 4 and all(p.isdigit() for p in parts):
        try:
            a, b, c, d = [int(x) for x in parts]
        except ValueError:
            return False, "Invalid IP"
        if any(n > 255 for n in (a, b, c, d)):
            return False, "Invalid IP"
        if a in (0, 10, 127) or (a == 169 and b == 254) or (a == 192 and b == 168) or (a == 172 and 16 <= b <= 31) or (a == 100 and 64 <= b <= 127):
            return False, "Blocked private IP"
    return True, ""

def rewrite_m3u8(content: str, original_url: str, proxy_base: str) -> str:
    """将 m3u8 内的所有 URI 改写为走代理"""
    base_url = original_url.rsplit("/", 1)[0] + "/"
    lines = []
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped:
            lines.append(line)
            continue
        # 处理带 URI="..." 的标签（如 EXT-X-KEY, EXT-X-MAP）
        if stripped.startswith("#"):
            def replace_uri(m):
                uri = m.group(1)
                abs_uri = uri if uri.startswith("http") else base_url + uri
                return f'URI="{proxy_base}?url={urllib.parse.quote(abs_uri, safe="")}"'
            new_line = re.sub(r'URI="([^"]+)"', replace_uri, stripped)
            lines.append(new_line)
        else:
            # segment URI
            abs_uri = stripped if stripped.startswith("http") else base_url + stripped
            lines.append(f"{proxy_base}?url={urllib.parse.quote(abs_uri, safe='')}")
    return "\n".join(lines)

@app.get("/api/proxy")
def video_proxy(request: Request, url: str = Query(...)):
    """视频代理：服务端不带 Referer 请求 CDN，m3u8 内链接自动改写"""
    ok, reason = is_safe_proxy_url(url)
    if not ok:
        raise HTTPException(status_code=400, detail=reason or "Blocked url")

    # 构建代理自身的 base URL（用于 m3u8 内链接改写）
    base = str(request.base_url).rstrip("/")
    proxy_base = f"{base}/api/proxy"

    try:
        resp = requests.get(url, headers=PROXY_HEADERS, timeout=15, stream=True)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"上游请求失败: {e}")

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="上游资源返回错误")

    content_type = resp.headers.get("Content-Type", "")
    is_m3u8 = "mpegurl" in content_type.lower() or url.split("?")[0].endswith(".m3u8")

    if is_m3u8:
        # 改写 m3u8 内的所有 URI
        text = resp.content.decode("utf-8", errors="replace")
        rewritten = rewrite_m3u8(text, url, proxy_base)
        return Response(
            content=rewritten,
            media_type="application/vnd.apple.mpegurl",
            headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache"},
        )
    else:
        # ts 分片等：流式透传
        def generate():
            for chunk in resp.iter_content(chunk_size=65536):
                yield chunk
        return StreamingResponse(
            generate(),
            media_type=content_type or "video/MP2T",
            headers={"Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600"},
        )

# ==================== 启动事件 ====================

@app.on_event("startup")
async def startup_event():
    init_db()
    subprocess.Popen([sys.executable, "build_sitemap_data.py", "--daemon"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
