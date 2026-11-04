import json
import os
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
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
        raw = json.dumps({'choices':[{'message':{'content':json.dumps(result)}}]}).encode()
        self.send_response(200); self.end_headers(); self.wfile.write(raw)


class CoachAPI(unittest.TestCase):
    def server(self, handler):
        httpd=ThreadingHTTPServer(('127.0.0.1',0), handler)
        threading.Thread(target=httpd.serve_forever,daemon=True).start()
        self.addCleanup(httpd.server_close); self.addCleanup(httpd.shutdown)
        return httpd

    def setUp(self):
        self.up=self.server(Provider); self.up.invalid=False
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

    def test_invalid_evidence_and_missing_key(self):
        self.up.invalid=True
        with self.assertRaises(urllib.error.HTTPError) as err: self.call('round')
        self.assertEqual(err.exception.code,502)
        with patch.dict(os.environ,{'LLM_API_KEY':''}):
            with self.assertRaises(urllib.error.HTTPError) as err: self.call('round')
            self.assertEqual(err.exception.code,503)
