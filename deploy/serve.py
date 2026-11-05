"""Serve the game and its same-origin OpenAI-compatible coaching endpoint."""
import json
import os
import re
import time
import urllib.error
import urllib.request
from collections import deque
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import BoundedSemaphore, Lock

ROOT = Path(__file__).resolve().parents[1] / 'dist'
GROUPS = ('risks', 'strengths', 'weaknesses')
SLOTS = BoundedSemaphore(4)
REQUESTS = deque()
LOCK = Lock()

def load_env(path=None):
    """Load single-line dotenv values without shell expansion or environment overrides."""
    path = Path(path) if path is not None else Path(__file__).resolve().parents[1] / '.env'
    try:
        lines = path.read_text(encoding='utf-8-sig').splitlines()
    except FileNotFoundError:
        return
    for number, line in enumerate(lines, 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        match = re.fullmatch(r'(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)', line)
        if not match:
            raise ValueError(f'Invalid .env assignment at line {number}')
        name, value = match.groups()
        if value.startswith(('"', "'")):
            pattern = r'"((?:[^"\\]|\\.)*)"\s*(?:#.*)?' if value[0] == '"' else r"'([^']*)'\s*(?:#.*)?"
            quoted = re.fullmatch(pattern, value)
            if not quoted:
                raise ValueError(f'Invalid .env quoting at line {number}')
            value = re.sub(r'\\([\\"])', r'\1', quoted[1]) if value[0] == '"' else quoted[1]
        else:
            value = re.split(r'\s+#', value, maxsplit=1)[0].rstrip()
            if value.startswith('#'):
                value = ''
        os.environ.setdefault(name, value)

def load_prompt():
    """The coach system prompt lives in an external file (coach-prompt.txt next to this
    script, overridable via COACH_PROMPT_FILE) so it can be tuned without editing serve.py."""
    path = os.environ.get('COACH_PROMPT_FILE') or str(Path(__file__).resolve().with_name('coach-prompt.txt'))
    try:
        return Path(path).read_text(encoding='utf-8').strip()
    except OSError:
        return ''

PROMPT = load_prompt()

def validate_input(data):
    if not isinstance(data, dict) or set(data) != {'stage','role','needs','evidence','client','actions','rounds','candidates'}:
        raise ValueError()
    if data['stage'] not in ('round','review','final') or data['role'] not in ('engineer','doctor','technician','teacher'):
        raise ValueError()
    pool = data['candidates']
    if not isinstance(pool, dict) or set(pool) != set(GROUPS):
        raise ValueError()
    for items in pool.values():
        if not isinstance(items, list) or len(items) > 100:
            raise ValueError()
        for f in items:
            if not isinstance(f,dict) or set(f) != {'id','text','round'} or not isinstance(f['text'],str) or len(f['text']) > 220 or not re.fullmatch(r'[0-6]-[a-z-]{1,45}', f['id']) or type(f['round']) is not int or not 0 <= f['round'] <= 6:
                raise ValueError()
    if not isinstance(data['rounds'],list) or len(data['rounds'])>6 or not isinstance(data['actions'],list) or len(data['actions'])>60:
        raise ValueError()
    return pool

def validate_output(result, pool):
    if not isinstance(result,dict) or set(result) != set(GROUPS):
        raise ValueError()
    for k in GROUPS:
        items = result[k]
        allowed = {f['id'] for f in pool[k]}
        if not isinstance(items,list) or len(items)>3 or bool(allowed)!=bool(items):
            raise ValueError()
        for entry in items:
            if not isinstance(entry,dict) or set(entry)!={'evidenceId','insight'} or entry['evidenceId'] not in allowed or not isinstance(entry['insight'],str) or not 0<len(entry['insight'].strip())<=220:
                raise ValueError()
            allowed.remove(entry['evidenceId'])
    return result

def text_content(content):
    """Mistral 的 message.content 可能是字串或 chunk 陣列（thinking/text 交錯），只取 text chunk。"""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return ''.join(part['text'] for part in content
                       if isinstance(part, dict) and part.get('type') == 'text' and isinstance(part.get('text'), str))
    raise ValueError()

def completion(data, key):
    if not PROMPT: raise ValueError('coach prompt file missing or empty')
    base = os.environ.get('LLM_BASE_URL','https://api.mistral.ai/v1').rstrip('/')
    body = {'model':os.environ.get('LLM_MODEL','zai-glm-5-3-flash'),
            'messages':[{'role':'system','content':PROMPT},{'role':'user','content':json.dumps(data,ensure_ascii=False)}],
            'response_format':{'type':'json_object'}, 'max_tokens':2000,
            'reasoning_effort':os.environ.get('LLM_REASONING_EFFORT','low') or None}
    if not body['reasoning_effort']:
        del body['reasoning_effort']
    req = urllib.request.Request(base+'/chat/completions', data=json.dumps(body).encode(),
            headers={'Content-Type':'application/json','Authorization':'Bearer '+key})
    with urllib.request.urlopen(req,timeout=25) as response:
        choice = json.load(response)['choices'][0]
    if choice.get('finish_reason') == 'length':
        raise ValueError()
    return validate_output(json.loads(text_content(choice['message']['content'])),data['candidates'])

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT),**kwargs)

    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        super().end_headers()

    def respond(self,code,body):
        raw=json.dumps(body,ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path.split('?')[0]=='/health':
            return self.respond(200,{'ok':True,'app':'LifeRisk','coachConfigured':bool(os.getenv('LLM_API_KEY'))})
        super().do_GET()

    def do_POST(self):
        if self.path!='/api/coach': return self.respond(404,{'error':'not_found'})
        if self.headers.get_content_type()!='application/json': return self.respond(415,{'error':'json_required'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0 < size <= 65536: return self.respond(413,{'error':'size'})
            data=json.loads(self.rfile.read(size))
            validate_input(data)
        except (ValueError,TypeError,KeyError,RecursionError):
            return self.respond(400,{'error':'invalid_request'})
        key=os.getenv('LLM_API_KEY')
        if not key: return self.respond(503,{'error':'coach_unconfigured'})
        with LOCK:
            now=time.monotonic()
            while REQUESTS and REQUESTS[0]<now-60: REQUESTS.popleft()
            if len(REQUESTS)>=40 or not SLOTS.acquire(blocking=False): return self.respond(429,{'error':'busy'})
            REQUESTS.append(now)
        try:
            result=completion(data,key)
        except urllib.error.HTTPError as error:
            self.log_error('LLM upstream HTTP %s; check endpoint, model and account access',error.code)
            return self.respond(502,{'error':'upstream_rejected'})
        except (OSError,ValueError,TypeError,KeyError,IndexError):
            return self.respond(502,{'error':'invalid_or_unavailable_upstream'})
        finally:
            SLOTS.release()
        self.respond(200,result)

if __name__=='__main__':
    load_env()
    PROMPT = load_prompt()
    port=int(os.getenv('PORT','8390'))
    print(f'LifeRisk listening on http://127.0.0.1:{port}',flush=True)
    ThreadingHTTPServer(('127.0.0.1',port),Handler).serve_forever()
