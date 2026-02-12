import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "data.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS movies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vod_id TEXT,
            title TEXT,
            poster TEXT,
            source_name TEXT,
            category TEXT,
            year TEXT,
            update_time TEXT,
            description TEXT,
            episodes TEXT,
            UNIQUE(title, source_name)
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_update_time ON movies (update_time DESC)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_title ON movies (title)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_category ON movies (category)')
    conn.commit()
    conn.close()

def save_movies(movies_list):
    """批量保存或更新电影数据"""
    conn = get_db()
    cursor = conn.cursor()
    for item in movies_list:
        try:
            # 处理播放列表
            episodes_raw = item.get("episodes", "")
            ep_list = []
            if isinstance(episodes_raw, list):
                ep_list = episodes_raw
            elif isinstance(episodes_raw, str) and episodes_raw:
                # 解析 CMS 格式的播放地址: "第1集$url1#第2集$url2"
                parts = episodes_raw.replace('\r', '').split("#")
                for p in parts:
                    if "$" in p:
                        try:
                            name, url = p.split("$", 1)
                            if any(ext in url.lower() for ext in [".m3u8", ".mp4"]):
                                ep_list.append({"name": name, "url": url})
                        except: continue
            
            # 如果依然解析不出有效链接（可能是格式不同），尝试检查原始 API 字段
            if not ep_list and "vod_play_url" in item:
                # 兼容直接传入原始 item 的情况
                raw_url = item["vod_play_url"]
                parts = raw_url.replace('\r', '').split("#")
                for p in parts:
                    if "$" in p:
                        try:
                            name, url = p.split("$", 1)
                            if any(ext in url.lower() for ext in [".m3u8", ".mp4"]):
                                ep_list.append({"name": name, "url": url})
                        except: continue

            cursor.execute('''
                INSERT OR REPLACE INTO movies 
                (vod_id, title, poster, source_name, category, year, update_time, description, episodes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(item.get("id", "")),
                item.get("title"),
                item.get("poster"),
                item.get("source", "默认"),
                item.get("category", "影视"),
                item.get("year", ""),
                item.get("update_time", ""),
                item.get("description", ""),
                json.dumps(ep_list, ensure_ascii=False)
            ))
        except Exception as e:
            print(f"Error saving movie {item.get('title')}: {e}")
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized.")
