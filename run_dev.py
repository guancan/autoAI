import os
import sys

# 获取虚拟环境的 bin 目录
venv_bin = os.path.join(os.path.dirname(__file__), 'venv', 'bin')

# 将虚拟环境的 bin 目录添加到 PATH
os.environ['PATH'] = os.pathsep.join([venv_bin, os.environ.get('PATH', '')])

# 更新 sys.prefix
sys.prefix = os.path.join(os.path.dirname(__file__), 'venv')

# 你的主要代码
if __name__ == '__main__':
    print("程序正在运行！")
    print(f"当前工作目录: {os.getcwd()}")
    print(f"Python 版本: {sys.version}")
    print(f"虚拟环境路径: {sys.prefix}")
