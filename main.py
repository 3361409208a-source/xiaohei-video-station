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

def fetch_engine_data(engine, keyword=None, type_id=None):
    try:
        if type_id:
            api_url = f"{engine['api']}?ac=detail&t={type_id}"
        else:
            api_url = f"{engine['api']}?ac=detail&wd={urllib.parse.quote(keyword)}"
            
        res = requests.get(api_url, timeout=5)
        data = res.json()
        results = []
        if data.get("list"):
            for item in data["list"]:
                play_url_raw = item.get("vod_play_url", "")
                ep_list = []
                if play_url_raw:
                    parts = play_url_raw.split("#")
                    for p in parts:
                        if "$" in p:
                            try:
                                name, url = p.split("$", 1)
                                if ".m3u8" in url.lower():
                                    ep_list.append({"name": name, "url": url})
                            except: continue
                
                results.append({
                    "id": str(item["vod_id"]),
                    "title": item["vod_name"],
                    "category": item.get("type_name", "影视"),
                    "poster": item.get("vod_pic", ""),
                    "episodes": ep_list,
                    "source_name": engine["name"],
                    "source_tip": engine["tip"]
                })
        return results
    except: return []

@app.get("/api/search")
def search(q: str = Query(None), t: str = Query(None)):
    if not q and not t: return []
    
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
    return fetch_engine_data(SOURCES[0], type_id="1")[:10]

@app.get("/api/detail")
def get_detail(id: str, src: str):
    engine = next((e for e in SOURCES if e["name"] == src), SOURCES[0])
    try:
        api_url = f"{engine['api']}?ac=detail&ids={id}"
        res = requests.get(api_url, timeout=5)
        data = res.json()
        if data.get("list"):
            item = data["list"][0]
            play_url_raw = item.get("vod_play_url", "")
            ep_list = []
            if play_url_raw:
                parts = play_url_raw.split("#")
                for p in parts:
                    if "$" in p:
                        try:
                            name, url = p.split("$", 1)
                            if ".m3u8" in url.lower():
                                ep_list.append({"name": name, "url": url})
                        except: continue
            return {
                "title": item["vod_name"],
                "poster": item.get("vod_pic", ""),
                "category": item.get("type_name", "影视"),
                "episodes": ep_list
            }
    except: pass
    return None

@app.get("/play")
def play_page():
    return FileResponse("play.html")

app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
