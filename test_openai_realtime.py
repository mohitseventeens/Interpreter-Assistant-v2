from flask import Flask, render_template, jsonify
import os
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file

app = Flask(__name__)
app.config['OPENAI_API_KEY'] = os.getenv('OPENAI_API_KEY')

@app.route('/')
def index():
    return render_template('testing_openai_realtime.html')

@app.route('/get-openai-key')
def get_openai_key():
    return jsonify({'openai_key': app.config['OPENAI_API_KEY']})

if __name__ == '__main__':
    # Run the Flask development server
    app.run(debug=True)
