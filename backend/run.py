"""仅监听本机；由启动脚本决定是否为用户打开浏览器。"""
import os
import time
import threading
import urllib.request
import webbrowser
import uvicorn
from app.main import create_app

def open_when_ready(url):
    for _ in range(80):
        try:
            with urllib.request.urlopen(url+'/api/health',timeout=1) as response:
                if response.status==200:
                    webbrowser.open(url);return
        except OSError:time.sleep(0.15)

if __name__=='__main__':
    port=int(os.getenv('CAMPUS_PORT','8791'))
    url=f'http://127.0.0.1:{port}'
    app=create_app()
    if os.getenv('CAMPUS_OPEN_BROWSER')=='1':
        threading.Thread(target=open_when_ready,args=(url,),daemon=True).start()
    print(f'校招罗盘已启动，请在浏览器打开 {url}',flush=True)
    uvicorn.run(app,host='127.0.0.1',port=port,log_level='warning',access_log=False)
