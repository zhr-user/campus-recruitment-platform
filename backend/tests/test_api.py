"""真实账号、隔离与权限的接口回归。使用独立临时库，不写入正式账号库。"""
import copy
import tempfile
import unittest
from pathlib import Path
from sqlalchemy import select
from fastapi.testclient import TestClient
from app.main import create_app
from app.models.user import User

class AccountTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent)
        self.url = 'sqlite:///' + str(Path(self.temp.name) / 'accounts.sqlite').replace('\\', '/')
        self.app = create_app(database_url=self.url, rate_limit=False)
        self.a = TestClient(self.app, base_url='http://localhost')
        self.b = TestClient(self.app, base_url='http://localhost')
        self.origin = {'Origin':'http://localhost'}
        self.password = 'A-long-private-password-2026'
    def tearDown(self):
        self.a.close(); self.b.close(); self.app.state.engine.dispose(); self.temp.cleanup()
    def post(self, client, path, body):
        response=client.post(path, json=body, headers=self.origin)
        if response.is_success and 'user' in response.json():client.headers['X-Account-Id']=str(response.json()['user']['id'])
        return response
    def register(self, client=None, email='a@example.com', **extra):
        return self.post(client or self.a, '/api/auth/register', {'email':email,'name':'求职用户','password':self.password,**extra})
    def test_01_anonymous_and_files(self):
        self.assertEqual(self.a.get('/api/state').status_code,401)
        self.assertEqual(self.a.get('/backend/data/accounts.sqlite').status_code,404)
        self.assertEqual(self.a.get('/backend/app/config.py').status_code,404)
    def test_02_registration_and_cookie(self):
        r=self.register(); self.assertEqual(r.status_code,201,r.text)
        cookie=r.headers['set-cookie']; self.assertIn('HttpOnly',cookie);self.assertIn('samesite=strict',cookie.lower());self.assertNotIn('Max-Age',cookie)
        self.assertEqual(r.json()['user']['role'],'candidate')
        self.assertEqual(r.json()['state']['applications'],[]);self.assertEqual(r.json()['state']['favorites'],[]);self.assertEqual(r.json()['state']['profile']['skills'],[])
        self.assertNotIn('password',r.text)
    def test_03_duplicate_and_invalid_fields(self):
        self.register(); self.assertEqual(self.register(email='A@EXAMPLE.COM').status_code,409)
        self.assertEqual(self.register(email='bad').status_code,400)
        self.assertEqual(self.register(email='c@example.com',password='1234').status_code,400)
        self.assertEqual(self.register(email='c@example.com',role='admin').status_code,400)
    def test_04_wrong_credentials(self):
        self.register()
        bad=self.post(self.b,'/api/auth/login',{'email':'a@example.com','password':'wrong'})
        missing=self.post(self.b,'/api/auth/login',{'email':'missing@example.com','password':'wrong'})
        self.assertEqual(bad.status_code,401);self.assertEqual(bad.json(),missing.json())
    def test_05_private_state_and_versions(self):
        r=self.register(); state=r.json()['state'];state['profile']['name']='甲的私有画像';state['favorites']=[self.app.state.catalog['jobs'][0]['id']]
        self.register(self.b,'b@example.com')
        r=self.a.put('/api/state',json={'state':state,'version':0},headers=self.origin);self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(self.b.get('/api/state').json()['state']['favorites'],[])
        self.assertEqual(self.a.get('/api/state').json()['state']['profile']['name'],'甲的私有画像')
        self.assertEqual(self.a.put('/api/state',json={'state':state,'version':0},headers=self.origin).status_code,409)
    def test_06_no_forged_owner_or_role(self):
        r=self.register();state=r.json()['state']
        self.assertEqual(self.a.put('/api/state',json={'state':state,'version':0,'userId':2},headers=self.origin).status_code,400)
        state['role']='admin';self.assertEqual(self.a.put('/api/state',json={'state':state,'version':0},headers=self.origin).status_code,400)
        self.assertEqual(self.a.get('/api/admin/summary').status_code,403)
    def test_07_csrf_and_forged_cookie(self):
        self.assertEqual(self.a.post('/api/auth/register',json={},headers={'Origin':'https://evil.example'}).status_code,403)
        self.assertEqual(self.a.post('/api/auth/register',json={}).status_code,403)
        self.b.cookies.set('campus_session','0'*64)
        self.assertEqual(self.b.get('/api/auth/me').status_code,401)
    def test_08_logout_revokes_and_login_restores(self):
        self.register();old=self.a.cookies.get('campus_session')
        r=self.post(self.a,'/api/auth/logout',{});self.assertEqual(r.status_code,200)
        self.b.cookies.set('campus_session',old);self.assertEqual(self.b.get('/api/auth/me').status_code,401)
        r=self.post(self.a,'/api/auth/login',{'email':'a@example.com','password':self.password,'remember':True})
        self.assertEqual(r.status_code,200);self.assertIn('Max-Age=2592000',r.headers['set-cookie'])
    def test_09_password_hash_and_rename(self):
        self.register();self.register(self.b,'b@example.com')
        with self.app.state.sessions() as session:
            users=session.scalars(select(User)).all();self.assertNotEqual(users[0].password_hash,users[1].password_hash)
            self.assertTrue(users[0].password_hash.startswith('scrypt$'));self.assertNotIn(self.password,users[0].password_hash)
        r=self.a.patch('/api/account',json={'name':'新的昵称'},headers=self.origin);self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(self.a.get('/api/auth/me').json()['user']['name'],'新的昵称')
    def test_10_restart_persists(self):
        self.register();token=self.a.cookies.get('campus_session')
        app2=create_app(database_url=self.url,rate_limit=False)
        with TestClient(app2,base_url='http://localhost') as client:
            client.cookies.set('campus_session',token);self.assertEqual(client.get('/api/auth/me').status_code,200)
        app2.state.engine.dispose()
    def test_11_admin_role_is_from_database(self):
        self.register()
        with self.app.state.sessions() as session:
            user=session.scalar(select(User));user.role='admin';session.commit()
        self.assertEqual(self.a.get('/api/admin/summary').status_code,200)
    def test_12_server_validation(self):
        state=self.register().json()['state'];state['profile']['skills']=['不存在的技能']
        self.assertEqual(self.a.put('/api/state',json={'state':state,'version':0},headers=self.origin).status_code,400)
        state=self.a.get('/api/state').json()['state'];state['adminJobsOff']=[self.app.state.catalog['jobs'][0]['id']]
        self.assertEqual(self.a.put('/api/state',json={'state':state,'version':0},headers=self.origin).status_code,403)
    def test_13_cross_window_account_binding(self):
        a=self.register().json()['user']['id']
        b=self.register(self.b,'b@example.com').json()['user']['id']
        old=self.a.get('/api/state').json()
        old['state']['profile']['name']='甲的私有画像'
        self.a.cookies.clear();self.a.cookies.set('campus_session',self.b.cookies.get('campus_session'))
        response=self.a.put('/api/state',json=old,headers=self.origin)
        self.assertEqual(response.status_code,409);self.assertEqual(response.json()['code'],'account_changed')
        self.assertEqual(self.b.get('/api/state').json()['state']['profile']['name'],'我的求职画像')
        self.assertEqual(self.a.patch('/api/account',json={'name':'错误昵称'},headers=self.origin).status_code,409)
        self.assertEqual(self.post(self.a,'/api/auth/logout',{}).status_code,409)
        self.assertEqual(self.b.get('/api/auth/me').status_code,200)
    def test_14_headers_and_rate_limit(self):
        r=self.a.get('/');self.assertEqual(r.status_code,200);self.assertIn('nonce-',r.headers['content-security-policy']);self.assertEqual(r.headers['x-frame-options'],'DENY')
        self.app.state.rate_limit=True
        for i in range(30):self.post(self.a,'/api/auth/login',{'email':'invalid','password':'x'})
        self.assertEqual(self.post(self.a,'/api/auth/login',{}).status_code,429)

if __name__=='__main__': unittest.main()

