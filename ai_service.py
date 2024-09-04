# ai_service.py

import requests
import logging
from models_config import AI_MODELS

API_SERVER = "https://api.api2gpt.com"
API_KEY = "AK-23924833-d7ae-4301-bd61-1edbf319a393"

logger = logging.getLogger(__name__)

def call_ai_api(prompt, model_name="gpt-3.5-turbo"):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": prompt}],
        # 删除这行
        # "max_tokens": max_tokens
    }
    
    try:
        # 修改日志记录,删除最大token数的信息
        logger.info(f"正在调用AI API，模型：{model_name}，提示词：{prompt}")
        response = requests.post(f"{API_SERVER}/v1/chat/completions", headers=headers, json=payload)
        response.raise_for_status()
        response_json = response.json()
        ai_response = response_json['choices'][0]['message']['content']
        token_count = response_json['usage']['total_tokens']
        logger.info(f"AI API调用成功，响应：{ai_response}")
        return {
            'success': True,
            'response': ai_response,
            'token_count': token_count,
            'full_response': response_json
        }
    except requests.exceptions.RequestException as e:
        error_message = f"调用AI服务时出错: {str(e)}"
        logger.error(error_message)
        return {
            'success': False,
            'error': error_message
        }

def get_model_list():
    return AI_MODELS
