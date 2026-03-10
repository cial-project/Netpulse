import sqlite3
import os

db_path = 'backend/db.sqlite3'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM api_port")
        columns = [description[0] for description in cursor.description]
        rows = cursor.fetchall()
        print(f"Total Ports: {len(rows)}")
        for row in rows:
            d = dict(zip(columns, row))
            print(d)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()
else:
    print(f"Database not found at {db_path}")
