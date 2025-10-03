import os
from flask import Flask, request, jsonify, render_template
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

# 댓글 작성 (Create)
@app.route("/reply", methods=["POST"])
def create_reply():
    data = request.get_json()
    post_id = data.get("post_id")
    member_id = data.get("member_id")
    contents = data.get("contents")

    if not (post_id and member_id and contents):
        return jsonify({"error": "Missing fields"}), 400

    #디비연결해서 쿼리문 작성부분
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("INSERT INTO reviews (post_id, member_id, contents) VALUES (?, ?, ?)",
    (post_id, member_id, contents))
    conn.commit()
    conn.close()

    return jsonify({"message": "Reply created successfully"}), 201

# 댓글 목록 조회 (Read)
@app.route("/reply/<int:post_id>", methods=["GET"])
def get_replies(post_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM reviews WHERE post_id = ?", (post_id,))
    rows = cur.fetchall()
    conn.close()

    replies = [dict(row) for row in rows]
    return jsonify(replies)


if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "False") == "True"
    app.run(debug=debug_mode)


