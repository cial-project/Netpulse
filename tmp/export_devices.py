import sqlite3
import os
import json

db_path = 'backend/db.sqlite3'
output_path = 'tmp/devices_output.json'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM api_device")
        columns = [description[0] for description in cursor.description]
        rows = cursor.fetchall()
        data = []
        for row in rows:
            data.append(dict(zip(columns, row)))
        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"Success: Wrote {len(rows)} devices to {output_path}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()
else:
    print(f"Database not found at {db_path}")
