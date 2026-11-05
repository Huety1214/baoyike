import io
import os
import runpy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from deploy import serve


class EnvFile(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.path = self.root / '.env'
        env = patch.dict(os.environ, {}, clear=True)
        env.start()
        self.addCleanup(env.stop)

    def test_values_quotes_comments_and_literal_special_characters(self):
        self.path.write_text('''\ufeff# local settings
export LLM_API_KEY = test#key=123 # comment
LLM_MODEL="model with spaces # literal" # comment
SINGLE='literal $HOME `command` \\path'
DOUBLE="escaped \\"quote\\" and \\\\path"
LITERAL=$(echo never-run)
EMPTY=
COMMENT= # empty value
PORT=8391
''', encoding='utf-8')
        serve.load_env(self.path)
        self.assertEqual(dict(os.environ), {
            'LLM_API_KEY': 'test#key=123', 'LLM_MODEL': 'model with spaces # literal',
            'SINGLE': 'literal $HOME `command` \\path', 'DOUBLE': 'escaped "quote" and \\path',
            'LITERAL': '$(echo never-run)', 'EMPTY': '', 'COMMENT': '', 'PORT': '8391'
        })

    def test_existing_environment_including_empty_values_wins(self):
        self.path.write_text('LLM_API_KEY=file-key\nPORT=8391\nLLM_MODEL=file-model\n', encoding='utf-8')
        with patch.dict(os.environ, {'LLM_API_KEY': '', 'PORT': '9000'}):
            serve.load_env(self.path)
            self.assertEqual(os.environ['LLM_API_KEY'], '')
            self.assertEqual(os.environ['PORT'], '9000')
            self.assertEqual(os.environ['LLM_MODEL'], 'file-model')

    def test_missing_file_is_optional(self):
        serve.load_env(self.path)
        self.assertEqual(dict(os.environ), {})

    def test_invalid_input_reports_line_without_value(self):
        for line in ['not-an-assignment secret-value', '1BAD=secret-value',
                     'KEY="secret-value', "KEY='secret-value' trailing"]:
            with self.subTest(line=line):
                self.path.write_text('# comment\n' + line, encoding='utf-8')
                with self.assertRaises(ValueError) as error:
                    serve.load_env(self.path)
                self.assertIn('line 2', str(error.exception))
                self.assertNotIn('secret-value', str(error.exception))

    def test_startup_loads_project_env_before_port_and_prompt(self):
        deploy = self.root / 'deploy'
        deploy.mkdir()
        script = deploy / 'serve.py'
        script.write_text(Path(serve.__file__).read_text(encoding='utf-8'), encoding='utf-8')
        (deploy / 'coach-prompt.txt').write_text('default prompt', encoding='utf-8')
        prompt = self.root / 'custom-prompt.txt'
        prompt.write_text('自訂教練 prompt', encoding='utf-8')
        self.path.write_text(f'PORT=8391\nLLM_API_KEY=test-only\nCOACH_PROMPT_FILE="{prompt}"\n', encoding='utf-8')
        # The working directory is outside the temporary project; importing must not load secrets.
        runpy.run_path(str(script), run_name='test_import')
        self.assertEqual(dict(os.environ), {})
        with patch('http.server.ThreadingHTTPServer') as server, patch('sys.stdout', new_callable=io.StringIO):
            result = runpy.run_path(str(script), run_name='__main__')
        self.assertEqual(server.call_args.args[0], ('127.0.0.1', 8391))
        server.return_value.serve_forever.assert_called_once_with()
        self.assertEqual(result['PROMPT'], '自訂教練 prompt')
        self.assertEqual(os.environ['LLM_API_KEY'], 'test-only')
        self.assertEqual(result['ROOT'], self.root / 'dist')
