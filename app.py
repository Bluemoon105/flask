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


if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "False") == "True"
    app.run(debug=debug_mode)
