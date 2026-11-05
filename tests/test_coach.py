import json
import os
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from deploy import serve


class Provider(BaseHTTPRequestHandler):
    def do_POST(self):
        payload = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        self.server.last = (self.path,self.headers['Authorization'],payload)
        context = json.loads(payload['messages'][1]['content'])
        result = {k:[{'evidenceId':f['id'],'insight':'核對本回合的保障與負擔。'} for f in items[:1]]
                  for k,items in context['candidates'].items()}
        if self.server.invalid: result['risks'][0]['evidenceId']='unknown'
        content = json.dumps(result)
        if self.server.chunked:
            content = [{'type':'thinking','thinking':[{'type':'text','text':'內部思考不該外流'}],'closed':True},
                       {'type':'text','text':content}]
        raw = json.dumps({'choices':[{'message':{'content':content},
                                      'finish_reason':getattr(self.server,'finish','stop')}]}).encode()
        self.send_response(200); self.end_headers(); self.wfile.write(raw)


class CoachAPI(unittest.TestCase):
    def server(self, handler):
        httpd=ThreadingHTTPServer(('127.0.0.1',0), handler)
        threading.Thread(target=httpd.serve_forever,daemon=True).start()
        self.addCleanup(httpd.server_close); self.addCleanup(httpd.shutdown)
        return httpd

    def setUp(self):
        self.up=self.server(Provider); self.up.invalid=False; self.up.chunked=False; self.up.finish='stop'
        self.app=self.server(serve.Handler)
        self.env=patch.dict(os.environ,{'LLM_BASE_URL':f'http://127.0.0.1:{self.up.server_port}/v1',
               'LLM_MODEL':'zai-glm-5-3-flash','LLM_API_KEY':'test-only'}); self.env.start(); self.addCleanup(self.env.stop)

    def call(self,stage):
        fact={'id':'1-reserve','round':1,'text':'現金緩衝'}
        pool={'risks':[fact], 'strengths':[], 'weaknesses':[]}
        if stage=='final': pool.update(strengths=[fact], weaknesses=[fact])
        data=dict(stage=stage,role='engineer',needs=['medical'],evidence=['cash'],client={},actions=[],rounds=[],candidates=pool)
        req=urllib.request.Request(f'http://127.0.0.1:{self.app.server_port}/api/coach', data=json.dumps(data).encode(),headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(req) as response: return json.load(response)

    def test_round_and_final(self):
        for stage in ['round','final']:
            result=self.call(stage)
            path,auth,payload=self.up.last
            self.assertEqual(path,'/v1/chat/completions'); self.assertEqual(auth,'Bearer test-only')
            self.assertEqual(payload['model'],'zai-glm-5-3-flash')
            self.assertEqual(payload['response_format'],{'type':'json_object'})
            self.assertEqual(bool(result['strengths']),stage=='final')

    def test_chunked_content_is_concatenated(self):
        self.up.chunked=True
        result=self.call('round')
        self.assertTrue(result['risks'])
        self.assertNotIn('內部思考', json.dumps(result,ensure_ascii=False))

    def test_truncated_completion_is_rejected(self):
        self.up.finish='length'
        with self.assertRaises(urllib.error.HTTPError) as err: self.call('round')
        self.assertEqual(err.exception.code,502)

    def test_invalid_evidence_and_missing_key(self):
        self.up.invalid=True
        with self.assertRaises(urllib.error.HTTPError) as err: self.call('round')
        self.assertEqual(err.exception.code,502)
        with patch.dict(os.environ,{'LLM_API_KEY':''}):
            with self.assertRaises(urllib.error.HTTPError) as err: self.call('round')
            self.assertEqual(err.exception.code,503)


class PromptFile(unittest.TestCase):
    def test_default_prompt_file_loaded(self):
        path = Path(serve.__file__).resolve().with_name('coach-prompt.txt')
        self.assertTrue(path.exists())
        self.assertEqual(serve.PROMPT, path.read_text(encoding='utf-8').strip())
        self.assertIn('risks', serve.PROMPT)
        self.assertIn('evidenceId', serve.PROMPT)
        self.assertIn('insight', serve.PROMPT)

    def test_env_override(self):
        with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False, encoding='utf-8') as f:
            f.write('自訂教練 prompt')
            name = f.name
        self.addCleanup(os.unlink, name)
        with patch.dict(os.environ, {'COACH_PROMPT_FILE': name}):
            self.assertEqual(serve.load_prompt(), '自訂教練 prompt')

    def test_missing_file_returns_empty(self):
        with patch.dict(os.environ, {'COACH_PROMPT_FILE': '/nonexistent/prompt.txt'}):
            self.assertEqual(serve.load_prompt(), '')
