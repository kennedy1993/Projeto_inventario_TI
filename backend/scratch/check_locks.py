import psycopg2

conn_str = "postgresql://postgres:30209713@localhost:5432/itam_avanco"

try:
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    
    cur.execute("SELECT pid, state, query FROM pg_stat_activity WHERE datname = 'itam_avanco' AND state != 'idle';")
    res = cur.fetchall()
    print("Active queries:")
    for r in res:
        print(f"PID: {r[0]}, State: {r[1]}, Query: {r[2]}")
    
    cur.close()
    conn.close()

except Exception as e:
    print(f"Error: {e}")
