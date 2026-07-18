import sqlite3
import json
import os
from play_url_parser import parse_play_episodes

DB_PATH = os.path.join(os.path.dirname(__file__), "data.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _migrate_unique_constraint(conn):
    """将 UNIQUE(title, source_name) 迁移为 UNIQUE(vod_id, source_name)"""
    cursor = conn.cursor()
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='movies'")
    row = cursor.fetchone()
    if not row or not row[0]:
        return
    ddl = row[0]
    if "UNIQUE(vod_id, source_name)" in ddl:
        return
    if "UNIQUE(title, source_name)" not in ddl:
        return

    print("[DB] Migrating movies unique key to (vod_id, source_name)...")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS movies_new (
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
            UNIQUE(vod_id, source_name)
        )
    ''')
    cursor.execute('''
        INSERT OR IGNORE INTO movies_new
        (vod_id, title, poster, source_name, category, year, update_time, description, episodes)
        SELECT vod_id, title, poster, source_name, category, year, update_time, description, episodes
        FROM movies
        ORDER BY update_time DESC
    ''')
    cursor.execute('DROP TABLE movies')
    cursor.execute('ALTER TABLE movies_new RENAME TO movies')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_update_time ON movies (update_time DESC)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_title ON movies (title)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_category ON movies (category)')
    conn.commit()
    print("[DB] Migration complete.")

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
            UNIQUE(vod_id, source_name)
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_update_time ON movies (update_time DESC)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_title ON movies (title)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_category ON movies (category)')
    conn.commit()
    try:
        _migrate_unique_constraint(conn)
    except Exception as e:
        print(f"[DB] Migration skipped/failed: {e}")
    conn.close()

def save_movies(movies_list):
    """批量保存或更新电影数据"""
    conn = get_db()
    cursor = conn.cursor()
    for item in movies_list:
        try:
            # 处理播放列表
            episodes_raw = item.get("episodes", "")
            if isinstance(episodes_raw, list):
                ep_list = episodes_raw
            elif isinstance(episodes_raw, str) and episodes_raw:
                ep_list = parse_play_episodes(episodes_raw)
            else:
                ep_list = []

            if not ep_list and "vod_play_url" in item:
                ep_list = parse_play_episodes(item.get("vod_play_url", ""))

            vod_id = str(item.get("id") or item.get("vod_id") or "")
            source_name = item.get("source") or item.get("source_name") or "默认"
            if not vod_id:
                continue

            cursor.execute('''
                INSERT INTO movies 
                (vod_id, title, poster, source_name, category, year, update_time, description, episodes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(vod_id, source_name) DO UPDATE SET
                    title=excluded.title,
                    poster=excluded.poster,
                    category=excluded.category,
                    year=excluded.year,
                    update_time=excluded.update_time,
                    description=excluded.description,
                    episodes=excluded.episodes
            ''', (
                vod_id,
                item.get("title"),
                item.get("poster"),
                source_name,
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
