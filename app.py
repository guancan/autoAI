import json
from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
import logging
import traceback
import requests
from ai_service import call_ai_api, get_model_list  # 导入AI服务

app = Flask(__name__)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if pd.isna(obj):
            return None
        return super(NpEncoder, self).default(obj)

API_SERVER = "https://api.api2gpt.com"
API_KEY = "AK-23924833-d7ae-4301-bd61-1edbf319a393"

@app.route('/')
def index():
    logger.info("访问主页")
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': '没有文件上传'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    if file and file.filename.endswith('.xlsx'):
        try:
            df = pd.read_excel(file)
            data = df.replace({np.nan: None}).to_dict(orient='split')
            return jsonify({
                'success': True,
                'columns': data['columns'],
                'data': data['data']
            }), 200
        except Exception as e:
            return jsonify({'error': f'处理文件时出错: {str(e)}'}), 500
    return jsonify({'error': '不支持的文件格式'}), 400

@app.route('/models')
def get_models():
    return jsonify(get_model_list())

@app.route('/process', methods=['POST'])
def process_data():
    data = request.json
    prompt = data['prompt']
    model = data.get('model', 'gpt-3.5-turbo')
    # 删除这行
    # max_tokens = data.get('max_tokens', 150)
    
    # 修改这行,删除max_tokens参数
    ai_result = call_ai_api(prompt, model)
    
    if ai_result['success']:
        logger.info(f"AI调用成功，响应：{ai_result['response']}")
        return jsonify({
            'success': True,
            'response': ai_result['response'],
            'token_count': ai_result['token_count'],
            'log': f"AI调用成功，模型：{model}，提示词：{prompt}，响应：{ai_result['response'][:100]}..."
        })
    else:
        logger.error(f"AI调用失败：{ai_result['error']}")
        return jsonify({
            'success': False,
            'error': ai_result['error'],
            'log': f"AI调用失败，模型：{model}，提示词：{prompt}，错误：{ai_result['error']}"
        })

if __name__ == '__main__':
    app.run(debug=True)
