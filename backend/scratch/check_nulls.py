import psycopg2

conn_str = "postgresql://postgres:30209713@localhost:5432/itam_avanco"

try:
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    
    fields = ['tag_patrimonio', 'marca', 'modelo', 'local_fisico', 'status']
    for field in fields:
        cur.execute(f"SELECT COUNT(*) FROM ativos WHERE {field} IS NULL;")
        count = cur.fetchone()[0]
        print(f"Field '{field}' has {count} NULL values.")
    
    cur.close()
    conn.close()

except Exception as e:
    print(f"Error: {e}")
