from flask import Flask, render_template, jsonify
import os
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file

app = Flask(__name__)
app.config['DEEPGRAM_API_KEY'] = os.getenv('DEEPGRAM_API_KEY')

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/get-deepgram-key")
def get_deepgram_key():
    return jsonify({'key': app.config['DEEPGRAM_API_KEY']})

if __name__ == "__main__":
    app.run(debug=False)  # Disable debug mode in production
