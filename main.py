from fastapi import FastAPI, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import requests
from bs4 import BeautifulSoup
import re
import urllib.parse
import sys
import io
import time
import concurrent.futures

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

BASE_URL = "https://nnyy.in"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://nnyy.in/',
}

session = requests.Session()
session.headers.update(HEADERS)

SOURCES = [
    {"name": "量子高清", "api": "https://cj.lziapi.com/api.php/provide/vod/from/lzm3u8/at/json/", "tip": "极速"},
    {"name": "飞飞资源", "api": "https://www.ffzyapi.com/api.php/provide/vod/from/ffm3u8/at/json/", "tip": "稳定"},
    {"name": "红牛专线", "api": "https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/", "tip": "专线"},
    {"name": "索尼资源", "api": "https://suoniapi.com/api.php/provide/vod/from/snm3u8/at/json/", "tip": "高清"}
]

def fetch_engine_data(engine, keyword=None, type_id=None, max_pages=5):
    """获取资源站数据，支持分页获取更多内容"""
    try:
        results = []

        # 如果没有关键词也没有分类ID，则是获取“最新更新”
        if not keyword and not type_id:
            api_url = f"{engine['api']}?ac=detail"
            try:
                res = requests.get(api_url, timeout=5)
                res.encoding = 'utf-8'
                data = res.json()
                if data.get("list"):
                    for item in data["list"]:
                        results.append(parse_item(item, engine))
            except: pass
            return results

        # 如果是按分类获取，支持多页
        if type_id:
            for page in range(1, max_pages + 1):
                api_url = f"{engine['api']}?ac=detail&t={type_id}&pg={page}"
                try:
                    res = requests.get(api_url, timeout=5)
                    res.encoding = 'utf-8'
                    data = res.json()

                    if not data.get("list"):
                        break  # 没有更多数据了

                    for item in data["list"]:
                        results.append(parse_item(item, engine))
                except:
                    break  # 请求失败，停止获取更多页
        else:
            # 关键词搜索，只获取第一页
            api_url = f"{engine['api']}?ac=detail&wd={urllib.parse.quote(keyword)}"
            res = requests.get(api_url, timeout=5)
            res.encoding = 'utf-8'
            data = res.json()

            if data.get("list"):
                for item in data["list"]:
                    results.append(parse_item(item, engine))

        return results
    except: return []

def parse_item(item, engine):
    """解析单个影片条目数据"""
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
        "source_tip": engine["tip"]
    }

@app.get("/api/search")
def search(q: str = Query(None), t: str = Query(None)):
    if not q and not t:
        # 如果既没有关键词也没有分类，返回所有源的最新更新
        unique_results = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(SOURCES)) as executor:
            # 每个源取第一页数据（ac=detail 不带 t 参数即为最新更新）
            futures = [executor.submit(fetch_engine_data, eng) for eng in SOURCES]
            for future in concurrent.futures.as_completed(futures):
                for item in future.result():
                    key = item['title']
                    if key not in unique_results:
                        unique_results[key] = item
        return list(unique_results.values())
    
    type_map = {"电影": "1", "电视剧": "2", "综艺": "3", "动漫": "4"}
    type_id = type_map.get(t) if t else None
    
    unique_results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(SOURCES)) as executor:
        futures = [executor.submit(fetch_engine_data, eng, q, type_id) for eng in SOURCES]
        for future in concurrent.futures.as_completed(futures):
            for item in future.result():
                key = item['title']
                if key not in unique_results or len(item['episodes']) > len(unique_results[key]['episodes']):
                    unique_results[key] = item
    return list(unique_results.values())

@app.get("/api/recommend")
def recommend():
    # 模拟推荐，其实就是获取电影分类的最新更新
    return fetch_engine_data(SOURCES[0], type_id="1", max_pages=1)[:10]

@app.get("/api/latest")
def get_latest(category: str = Query(None), hours: int = Query(24)):
    """获取最近更新的影片

    参数:
    - category: 分类（电影/电视剧/动漫/综艺），不传则获取所有分类
    - hours: 最近N小时更新的内容，默认24小时
    """
    type_map = {"电影": "1", "电视剧": "2", "综艺": "3", "动漫": "4"}

    if category and category in type_map:
        # 获取指定分类的最新更新
        type_id = type_map[category]
        results = []

        # 从所有资源站获取最新数据
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(SOURCES)) as executor:
            futures = [executor.submit(fetch_engine_data, eng, type_id=type_id, max_pages=2) for eng in SOURCES]
            for future in concurrent.futures.as_completed(futures):
                results.extend(future.result())

        # 按影片ID去重
        unique_results = {}
        for item in results:
            key = item['id']
            if key not in unique_results or len(item['episodes']) > len(unique_results[key]['episodes']):
                unique_results[key] = item

        return list(unique_results.values())[:50]
    else:
        # 获取所有分类的最新更新
        all_results = []
        for cat, type_id in type_map.items():
            results = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=len(SOURCES)) as executor:
                futures = [executor.submit(fetch_engine_data, eng, type_id=type_id, max_pages=1) for eng in SOURCES]
                for future in concurrent.futures.as_completed(futures):
                    results.extend(future.result())

            # 每个分类取前10部
            unique_results = {}
            for item in results:
                key = item['id']
                if key not in unique_results:
                    unique_results[key] = item

            all_results.extend(list(unique_results.values())[:10])

        return all_results

@app.get("/api/detail")
def get_detail(id: str, src: str):
    # 彻底解决 URL 编码导致的匹配失败
    decoded_src = urllib.parse.unquote(src)
    engine = next((e for e in SOURCES if e["name"] == decoded_src or e["name"] == src), SOURCES[0])
    
    try:
        api_url = f"{engine['api']}?ac=detail&ids={id}"
        res = requests.get(api_url, timeout=5)
        # 彻底解决乱码：如果响应头没写 charset，requests 可能猜错成 ISO-8859-1
        res.encoding = res.apparent_encoding if res.apparent_encoding else 'utf-8'
        
        data = res.json()
        if data.get("list"):
            item = data["list"][0]
            play_url_raw = item.get("vod_play_url", "")
            ep_list = []
            if play_url_raw:
                # 兼容多种分割符和空行
                lines = play_url_raw.replace('\r', '').split('#')
                for p in lines:
                    if "$" in p:
                        try:
                            name, url = p.split("$", 1)
                            # 增加对多种流媒体后缀的支持
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
    except Exception as e:
        print(f"Detail fetch error: {e}")
    return None

@app.get("/play")
def play_page():
    return FileResponse("play.html")

app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
