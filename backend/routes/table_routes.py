from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
import psycopg2
import os
from dotenv import load_dotenv
from .auth_routes import get_current_admin_user

load_dotenv("backend/.env")

router = APIRouter(dependencies=[Depends(get_current_admin_user)])

def get_conn():
    return psycopg2.connect(
        dbname=os.getenv("POSTGRES_DATABASE"),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
        host=os.getenv("POSTGRES_HOST"),
        port=os.getenv("POSTGRES_PORT")
    )

@router.get("/tables")
def get_tables():
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
        """)
        tables = [row[0] for row in cur.fetchall()]
        cur.close()
        conn.close()
        return tables
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tables/{table_name}/schema")
def get_table_schema(table_name: str):
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT a.attname, format_type(a.atttypid, a.atttypmod),
                   (i.indisprimary IS TRUE) AS is_primary
            FROM   pg_attribute a
            LEFT JOIN pg_index i ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE  a.attrelid = %s::regclass AND a.attnum > 0 AND NOT a.attisdropped
        """, (table_name,))
        schema = [
            {"name": row[0], "type": row[1], "is_primary": row[2]} for row in cur.fetchall()
        ]
        cur.close()
        conn.close()
        return schema
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tables/{table_name}")
def read_table(table_name: str):
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f'SELECT * FROM "{table_name}" LIMIT 100')
        columns = [desc[0] for desc in cur.description]
        rows = [dict(zip(columns, row)) for row in cur.fetchall()]
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tables/{table_name}")
def create_row(table_name: str, row: Dict[str, Any]):
    try:
        conn = get_conn()
        cur = conn.cursor()
        keys = ', '.join([f'"{k}"' for k in row.keys()])
        placeholders = ', '.join([f'%({k})s' for k in row.keys()])
        query = f'INSERT INTO "{table_name}" ({keys}) VALUES ({placeholders})'
        cur.execute(query, row)
        conn.commit()
        cur.close()
        conn.close()
        return {"status": "created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/tables/{table_name}/{pk}")
def update_row(table_name: str, pk: str, row: Dict[str, Any]):
    try:
        pk_name = get_primary_key(table_name)

        # Remove the PK from update values
        values = {k: v for k, v in row.items() if k != pk_name}

        if not values:
            raise HTTPException(status_code=400, detail="No fields to update")

        assignments = ', '.join([f'"{k}" = %({k})s' for k in values.keys()])
        query = f'UPDATE "{table_name}" SET {assignments} WHERE "{pk_name}" = %(pk)s'

        values['pk'] = pk  # only for WHERE clause
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(query, values)
        conn.commit()
        cur.close()
        conn.close()
        return {"status": "updated"}
    except Exception as e:
        print("❌ Update error:", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/tables/{table_name}/{pk}")
def delete_row(table_name: str, pk: str):
    try:
        pk_name = get_primary_key(table_name)
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f'DELETE FROM "{table_name}" WHERE "{pk_name}" = %s', (pk,))
        conn.commit()
        cur.close()
        conn.close()
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/overview")
def get_overview():
    try:
        conn = get_conn()
        cur = conn.cursor()

        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
        """)
        tables = [row[0] for row in cur.fetchall()]

        overview = {}
        for table in tables:
            try:
                cur.execute(f'SELECT COUNT(*) FROM public."{table}"')
                count = cur.fetchone()[0]
                overview[table] = count
            except Exception as table_err:
                overview[table] = f"Error: {str(table_err)}"  

        cur.close()
        conn.close()
        return overview
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Overview failed: {str(e)}")



def get_primary_key(table_name: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT a.attname
        FROM   pg_index i
        JOIN   pg_attribute a ON a.attrelid = i.indrelid
                             AND a.attnum = ANY(i.indkey)
        WHERE  i.indrelid = %s::regclass
        AND    i.indisprimary;
    """, (table_name,))
    result = cur.fetchone()
    cur.close()
    conn.close()
    if not result:
        raise HTTPException(status_code=400, detail="No primary key defined")
    return result[0]

