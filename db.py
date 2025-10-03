# db.py
import os
import pymysql
from dotenv import load_dotenv

# .env 파일 읽기
load_dotenv()

# DB 연결 정보 가져오기
DB_HOST = os.getenv("DB_HOST","192.168.0.23")
DB_PORT = int(os.getenv("DB_PORT", 3306))  # 기본 포트 3306
DB_USER = os.getenv("DB_USER","root")
DB_PASSWORD = os.getenv("DB_PASSWORD","1111")
DB_DATABASE = os.getenv("DB_DATABASE","flask")

def get_db_connection():
    """MariaDB 연결 후 connection 객체 반환"""
    try:
        conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_DATABASE
        )
        print("✅ DB 연결 성공!")
        return conn
    except Exception as e:
        print("❌ DB 연결 실패:", e)
        return None

# 테스트용 실행 코드
if __name__ == "__main__":
    conn = get_db_connection()
    if conn:
        print("DB 연결 테스트 완료. 연결 종료합니다.")
        conn.close()
