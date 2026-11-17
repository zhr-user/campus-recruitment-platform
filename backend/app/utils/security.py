"""使用标准库 scrypt 保存加盐密码，数据库仅保存会话令牌的摘要。"""
import hashlib
import hmac
import secrets
N, R, P = 32768, 8, 3

def hash_password(password):
    salt=secrets.token_bytes(16)
    digest=hashlib.scrypt(password.encode('utf-8'),salt=salt,n=N,r=R,p=P,dklen=64,maxmem=64*1024*1024)
    return f'scrypt\u0024{N}\u0024{R}\u0024{P}\u0024{salt.hex()}\u0024{digest.hex()}'
def verify_password(password,encoded):
    try:
        tag,n,r,p,salt,digest=encoded.split('$')
        if tag!='scrypt': return False
        actual=hashlib.scrypt(password.encode('utf-8'),salt=bytes.fromhex(salt),n=int(n),r=int(r),p=int(p),dklen=64,maxmem=64*1024*1024)
        return hmac.compare_digest(actual.hex(),digest)
    except (ValueError,TypeError): return False

def token_hash(token):
    return hashlib.sha256(token.encode('ascii')).hexdigest()
