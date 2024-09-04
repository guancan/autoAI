#!/bin/bash

# 定义应用程序的名称和路径
APP_NAME="app.py"
VENV_PATH="./venv"
PID_FILE="app.pid"

# 函数：停止当前运行的Flask应用
stop_app() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null; then
            echo "Stopping existing Flask application (PID: $PID)"
            kill $PID
            sleep 2
        fi
        rm "$PID_FILE"
    fi
}

# 函数：启动Flask应用
start_app() {
    echo "Starting Flask application"
    python3 "$APP_NAME" &
    echo $! > "$PID_FILE"
}

# 停止当前运行的应用
stop_app

# 激活虚拟环境
source "$VENV_PATH/bin/activate"

# 启动新的应用
start_app

echo "Flask application started. PID saved in $PID_FILE"