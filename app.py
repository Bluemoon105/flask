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


@app.route("/reply", methods=["POST"])
def create_reply():
    data = request.get_json()
    print(data)
    post_id = data.get("post_id")
    contents = data.get("text")
    rating = data.get("rating")
    is_public = data.get("is_spoiler")

    if not (post_id and rating and contents):
        return jsonify({"error": "Missing fields"}), 400


    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("INSERT INTO reviews (item_id, content, rating, is_public) VALUES (%s, %s, %s, %s)",
    (post_id, contents,rating, is_public))
    conn.commit()
    conn.close()

    return jsonify({"message": "Reply created successfully"}), 201


@app.route("/reply/<post_id>", methods=["GET"])
def get_replies(post_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM reviews WHERE item_id = %s", (str(post_id),))
            rows = cur.fetchall()
            print("skldjflksdjflsdjflkjflskdfklsdfjlksdjflksdfjlksdfjklsdfjklds")
            print(rows)
        return jsonify(rows), 200
    finally:
        conn.close()


if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "False") == "True"
    app.run(debug=debug_mode)


