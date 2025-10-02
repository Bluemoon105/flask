import os
from flask import Flask, request, jsonify, render_template
import requests
from db import get_db_connection
from dotenv import load_dotenv

# .env 파일 읽기
load_dotenv()

app = Flask(__name__)

@app.route("/")
def home():
    conn = get_db_connection()
    if conn:
        conn.close()
    return render_template("index.html", name="name")

# '/search/blog' URL 요청을 처리하는 API 엔드포인트
@app.route('/search/blog', methods=['GET'])
def search_blog():
    # 1. 브라우저가 보낸 검색어(query)를 가져옴
    query = request.args.get('query')
    if not query:
        return jsonify({'error': '검색어(query)가 필요합니다.'}), 400

    # 2. 네이버 API에 요청 준비
    naver_api_url = 'https://dapi.kakao.com/v3/search/book'
    headers = {
        'Authorization: KakaoAK 41fc150e1acbe4e67e080a6c497099b2'
    }
    params = {
        'query': query
    }

    try:
        # 3. 네이버 API에 요청 보내기
        response = requests.get(naver_api_url, headers=headers, params=params)
        response.raise_for_status()  # 200번대 응답이 아니면 예외 발생

        # 4. 네이버로부터 받은 결과를 브라우저에 전달
        return jsonify(response.json())

    except requests.exceptions.RequestException as e:
        # 네트워크 오류 또는 API 오류 처리
        return jsonify({'error': str(e)}), 500


if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "False") == "True"
    app.run(debug=debug_mode,port=3000)
