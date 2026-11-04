import sys,os,pathlib,json,re
from playwright.sync_api import sync_playwright
sys.path.insert(0,os.path.dirname(__file__));from stub import STUB
ROOT=pathlib.Path(__file__).resolve().parent.parent;URL=os.environ.get('BIMO_URL') or (ROOT/'index.html').as_uri()
F=[];P=[]
def chk(n,ok,i=''):(P if ok else F).append(n+(' -> '+str(i)[:160] if i!='' else ''))
PW='Secure@123'
with sync_playwright() as p:
    b=p.chromium.launch()
    def page(w=390,h=844,cfg=None,touch=True):
        ctx=b.new_context(viewport={'width':w,'height':h},has_touch=touch);ctx.add_init_script(STUB)
        if cfg:ctx.add_init_script("window.BIMO_OTP_CONFIG="+json.dumps(cfg))
        pg=ctx.new_page();pg.errs=[];pg.on('pageerror',lambda e:pg.errs.append(str(e)[:100]));pg.goto(URL);pg.wait_for_timeout(900)
        pg.evaluate("()=>{window.showAppShell=u=>{window.__shown=u}}");return pg
    def reg(pg,email='a@b.co',phone='',pw=PW,conf=None):
        pg.evaluate("()=>{cancelSignup()}");pg.fill('#regEmail',email);pg.fill('#regPhone',phone);pg.fill('#passInput',pw);pg.fill('#confirmPassInput',pw if conf is None else conf);pg.click('#authActionBtn');pg.wait_for_timeout(250)
    ST=lambda pg:pg.evaluate("()=>({auth:authScreen.classList.contains('active'),otp:otpScreen.classList.contains('active'),ob:onboardScreen.classList.contains('active')})")
    toast=lambda pg:pg.inner_text('#toastContainer')
    code=lambda pg:pg.evaluate("()=>otpDemoCode.textContent")
    adv=lambda pg,s:pg.evaluate("(s)=>{window.__t+=s*1000}",s)
    # ---------- 1. step-1 validation: nothing reaches the OTP screen
    pg=page();pg.evaluate("()=>{window.__existing=['taken@x.com']}")
    for name,args,msg in [('no identity',dict(email=''),'at least one'),('bad email',dict(email='nope'),'not valid'),('bad phone',dict(email='',phone='abc'),'not valid'),('weak password',dict(pw='short',),'too short'),('mismatch',dict(conf='Other@1234'),'do not match'),('existing account',dict(email='taken@x.com'),'already exists')]:
        reg(pg,**args);s=ST(pg);chk(f'step 1 blocks: {name}',s['auth'] and not s['otp'] and msg in toast(pg),(s,toast(pg)[:50]))
    # ---------- 2. happy path (demo mode)
    reg(pg,'ab@shop.co');s=ST(pg)
    chk('valid details open the OTP screen',s['otp'] and not s['auth'] and not s['ob'],s)
    chk('demo box shows a 6-digit code and says it is not real verification',bool(re.fullmatch(r'\d{6}',code(pg))) and 'not real verification' in pg.inner_text('#otpDemoBox'))
    chk('OTP screen text: email title, masked target, demo wording',pg.inner_text('#otpTitle')=='Verify your email' and pg.inner_text('#otpTarget')=='ab***@shop.co' and 'Demo mode' in pg.inner_text('#otpSubtitle'))
    chk('one-time-code autofill + numeric keypad + >=16px',pg.evaluate("()=>{const i=otpInput;return[i.autocomplete,i.inputMode,parseFloat(getComputedStyle(i).fontSize)]}")==['one-time-code','numeric',28.0])
    real=code(pg);wrong='000000' if real!='000000' else '111111'
    pg.fill('#otpInput',wrong);pg.wait_for_timeout(200);chk('wrong code: message, 4 attempts left, input cleared',('not right' in toast(pg)) and '4 attempts left' in pg.inner_text('#otpAttempts') and pg.input_value('#otpInput')=='',(toast(pg)[:60],pg.inner_text('#otpAttempts')))
    pg.fill('#otpInput','12345');pg.press('#otpInput','Enter');chk('Enter with 5 digits asks for 6',('6-digit' in toast(pg)))
    pg.fill('#otpInput',real[:3]+' '+real[3:]);pg.wait_for_timeout(250);s=ST(pg);chk('pasting "123 456" auto-verifies and opens step 3',s['ob'] and not s['otp'],s)
    # ---------- 3. onboarding
    pg.fill('#obName','');pg.click('#obFinishBtn');chk('step 3 requires a shop name',pg.evaluate("()=>__creates.length")==0 and 'required' in toast(pg))
    pg.fill('#obName','Dhaka Threads');pg.fill('#obUrl','ftp://x');pg.click('#obFinishBtn');chk('step 3 rejects a bad link',pg.evaluate("()=>__creates.length")==0 and 'http' in toast(pg))
    pg.evaluate("()=>{__createErr='Email already registered'}");pg.fill('#obUrl','https://facebook.com/x');pg.click('#obFinishBtn');pg.wait_for_timeout(200)
    chk('account-creation error is shown and user stays on step 3',ST(pg)['ob'] and 'already registered' in toast(pg))
    pg.evaluate("()=>{__createErr=null;__creates.length=0}");pg.evaluate("()=>{finishOnboarding();finishOnboarding();finishOnboarding()}");pg.wait_for_timeout(300)
    cr=pg.evaluate("()=>__creates");chk('triple-tap Finish creates exactly one account',len(cr)==1,len(cr))
    c=cr[0] if cr else {}
    chk('account gets every collected field + how it was verified',(c.get('email'),c.get('pass'),c.get('brandName'),c.get('brandType'),c.get('brandUrl'),c.get('verifiedVia'),c.get('otpMode'))==('ab@shop.co',PW,'Dhaka Threads','Facebook Page','https://facebook.com/x','email','demo'),c)
    chk('app opens after finish and screens are hidden',pg.evaluate("()=>!!window.__shown")and not any(ST(pg).values()))
    chk('flow state wiped: password, OTP, pending sign-up',pg.evaluate("()=>[passInput.value,confirmPassInput.value,pendingSignup,BimoOtp.status().active]")==['','',None,False])
    chk('audit entry written',pg.evaluate("()=>__audit.some(a=>a[1]=='SIGNUP_VERIFIED')"))
    chk('no JS errors in happy path',not pg.errs,pg.errs);pg.context.close()
    # ---------- 4. randomness of codes
    pg=page();codes=pg.evaluate("async()=>{const o=[];for(let i=0;i<400;i++){BimoOtp.reset();o.push((await BimoOtp.send({type:'email',value:'x@y.z'})).demoCode)}return o}")
    chk('400 codes: all exactly 6 digits',all(re.fullmatch(r'\d{6}',c) for c in codes))
    chk('400 codes: (almost) all different - never a fixed code',len(set(codes))>=395 and '123456' not in codes[:50],len(set(codes)))
    cnt=[sum(c.count(str(d)) for c in codes) for d in range(10)];chk('digits evenly spread (no bias)',all(180<=x<=300 for x in cnt),cnt)
    chk('leading zeros appear (codes not stored as numbers)',sum(c[0]=='0' for c in codes)>=15,sum(c[0]=='0' for c in codes))
    pg.context.close()
    # ---------- 5. lockout, resend, expiry, send limit
    pg=page();reg(pg);real=code(pg);bad=lambda c:('000000' if c!='000000' else '111111')
    chk('immediate resend is blocked with a countdown',pg.evaluate("()=>[otpResendBtn.disabled,otpResendBtn.textContent]")[0] and 'Resend code (' in pg.inner_text('#otpResendBtn'))
    r=pg.evaluate("async()=>BimoOtp.send(currentTarget())");chk('engine refuses a second code inside 30 s',r['code']=='cooldown',r)
    for i in range(5):pg.fill('#otpInput',bad(real));pg.wait_for_timeout(120)
    chk('5 wrong codes lock the code',pg.evaluate("()=>BimoOtp.status().locked")and 'locked' in pg.inner_text('#otpAttempts') and pg.evaluate("()=>otpVerifyBtn.disabled"))
    pg.fill('#otpInput',real);pg.wait_for_timeout(150);chk('after lock even the right code is refused',ST(pg)['otp'] and 'Too many wrong' in toast(pg))
    adv(pg,31);pg.evaluate("()=>renderOtp()");chk('after 31 s the resend button is live again',not pg.evaluate("()=>otpResendBtn.disabled"))
    pg.click('#otpResendBtn');pg.wait_for_timeout(250);new=code(pg);chk('resend gives a fresh code and resets attempts','5 attempts left' in pg.inner_text('#otpAttempts') and not pg.evaluate("()=>otpVerifyBtn.disabled"))
    old_works=pg.evaluate("async(c)=>(await BimoOtp.verify(c)).ok",real) if real!=new else False;chk('the previous code no longer works',old_works==False)
    adv(pg,301);pg.evaluate("()=>renderOtp()");chk('code expires after 5 minutes (UI says expired, Verify disabled)',pg.inner_text('#otpExpiry')=='expired' and pg.evaluate("()=>otpVerifyBtn.disabled"))
    r=pg.evaluate("async(c)=>BimoOtp.verify(c)",new);chk('expired code is rejected even if correct',r['code']=='expired',r)
    adv(pg,31);pg.evaluate("()=>renderOtp()");pg.click('#otpResendBtn');pg.wait_for_timeout(250);chk('resend after expiry works',pg.evaluate("async()=>(await BimoOtp.verify(otpDemoCode.textContent)).ok"))
    pg.context.close()
    pg=page();reg(pg);res=[]
    for i in range(6):adv(pg,31);res.append(pg.evaluate("async()=>(await BimoOtp.send(currentTarget())).code||'ok'"))
    chk('max 5 codes per sign-up session',res[-1]=='limit' and res[:4]==['ok']*4,res);pg.context.close()
    # ---------- 6. phone + email: switching channel
    pg=page();reg(pg,'me@shop.co','01712345678');first=code(pg)
    chk('phone is verified first when both are given',pg.inner_text('#otpTitle')=='Verify your phone' and pg.inner_text('#otpTarget')=='017*****678',pg.inner_text('#otpTarget'))
    chk('switch link offers the email',pg.inner_text('#otpSwitchBtn')=='Send the code to my email instead')
    pg.click('#otpSwitchBtn');chk('switching inside the cooldown is refused and nothing changes',pg.inner_text('#otpTitle')=='Verify your phone' and 'Please wait' in toast(pg))
    adv(pg,31);pg.click('#otpSwitchBtn');pg.wait_for_timeout(250);chk('after cooldown it switches to email with a new code',pg.inner_text('#otpTitle')=='Verify your email' and pg.inner_text('#otpSwitchBtn')=='Send the code to my phone instead')
    chk('the phone code is useless after switching',pg.evaluate("async(c)=>(await BimoOtp.verify(c)).ok",first)==False or first==code(pg))
    pg.fill('#otpInput',code(pg));pg.wait_for_timeout(250);pg.fill('#obName','Shop');pg.click('#obFinishBtn');pg.wait_for_timeout(200)
    chk('verifying the email creates the account with verifiedVia=email and both identifiers',pg.evaluate("()=>[__creates[0].verifiedVia,__creates[0].phone,__creates[0].email]")==['email','01712345678','me@shop.co'])
    pg.context.close()
    # ---------- 7. cancel, bypass attempts, nothing persisted
    pg=page();reg(pg,'keep@me.co');pg.click('text=Change my details');s=ST(pg)
    chk('"Change my details" returns to step 1 with email kept, passwords cleared, timers stopped',s['auth'] and pg.input_value('#regEmail')=='keep@me.co' and pg.input_value('#passInput')=='' and pg.evaluate("()=>[otpTick,BimoOtp.status().active,authTitle.textContent]")==[None,False,'Create your account'])
    pg.evaluate("()=>{showScreen('onboardScreen');obName.value='Hack';finishOnboarding()}");pg.wait_for_timeout(200)
    chk('opening step 3 by hand without signing up is refused',pg.evaluate("()=>__creates.length")==0 and ST(pg)['auth'])
    reg(pg,'v@x.co');pg.evaluate("()=>{showScreen('onboardScreen');obName.value='Hack';finishOnboarding()}");pg.wait_for_timeout(200)
    chk('skipping the OTP step is refused and sends the user back to it',pg.evaluate("()=>__creates.length")==0 and ST(pg)['otp'] and 'verify your code' in toast(pg))
    stor=pg.evaluate("()=>JSON.stringify([localStorage,sessionStorage])");chk('password and code are never written to storage',PW not in stor and code(pg) not in stor)
    pg.reload();pg.wait_for_timeout(700);chk('reload mid-sign-up starts clean at login',ST(pg)['auth'] and not ST(pg)['otp'])
    pg.context.close()
    # ---------- 8. API mode (server sends + checks; browser never sees the code)
    def api(pg,send=None,verify=None):
        log={'send':[],'verify':[]}
        def h_send(route):
            log['send'].append(json.loads(route.request.post_data));(send or (lambda r:r.fulfill(status=200,content_type='application/json',body='{"ok":true}')))(route)
        def h_ver(route):
            log['verify'].append(json.loads(route.request.post_data));(verify or (lambda r:r.fulfill(status=200,content_type='application/json',body='{"ok":true}')))(route)
        pg.route('**/otp/send',h_send);pg.route('**/otp/verify',h_ver);return log
    pg=page(cfg={'mode':'api','endpoint':'/otp','timeoutMs':600});pg.route('**/*',lambda r:r.continue_()) 
    pg.context.route('http://**/otp/**',lambda r:r.fulfill(status=200,body='{"ok":true}')) if False else None
    log=api(pg);reg(pg,'api@x.co');chk('api mode: server got type+to, browser shows no code, wording says "sent"',log['send']==[{'type':'email','to':'api@x.co'}] and pg.evaluate("()=>otpDemoBox.style.display")=='none' and 'We sent a 6-digit code' in pg.inner_text('#otpSubtitle') and pg.evaluate("()=>otpDemoCode.textContent")=='',log['send'])
    chk('api mode: demo banner absent',not pg.is_visible('#otpDemoBox'))
    pg.unroute('**/otp/verify');log2=api(pg,verify=lambda r:r.fulfill(status=400,content_type='application/json',body='{"ok":false,"error":"bad"}'))
    pg.fill('#otpInput','111111');pg.wait_for_timeout(300);chk('api: server says wrong -> attempt counted',pg.evaluate("()=>BimoOtp.status().attemptsLeft")==4 and 'not right' in toast(pg))
    pg.unroute('**/otp/verify');api(pg,verify=lambda r:r.fulfill(status=503,content_type='application/json',body='{"error":"down"}'))
    pg.fill('#otpInput','222222');pg.wait_for_timeout(300);chk('api: server error (5xx) is NOT counted as a wrong guess',pg.evaluate("()=>BimoOtp.status().attemptsLeft")==4 and 'down' in toast(pg),toast(pg)[:60])
    pg.unroute('**/otp/verify');api(pg);pg.fill('#otpInput','333333');pg.wait_for_timeout(300);chk('api: server accepts -> step 3',ST(pg)['ob'])
    pg.context.close()
    pg=page(cfg={'mode':'api','endpoint':'/otp','timeoutMs':400});api(pg,send=lambda r:r.abort());reg(pg,'n@x.co');chk('api: network failure -> friendly error, stays on OTP, retry allowed at once','No connection' in toast(pg) and ST(pg)['otp'] and not pg.evaluate("()=>otpResendBtn.disabled"),toast(pg)[:50])
    pg.unroute('**/otp/send');api(pg);pg.click('#otpResendBtn');pg.wait_for_timeout(300);chk('api: retry after network failure succeeds',pg.evaluate("()=>BimoOtp.status().active")==True)
    pg.context.close()
    pg=page(cfg={'mode':'api','endpoint':'/otp','timeoutMs':300});api(pg,send=lambda r:(pg.wait_for_timeout(900),r.abort()));reg(pg,'t@x.co');pg.wait_for_timeout(900);chk('api: slow server -> "took too long"','too long' in toast(pg),toast(pg)[:60]);pg.context.close()
    pg=page(cfg={'mode':'api','endpoint':'/otp'});api(pg,send=lambda r:r.fulfill(status=429,content_type='application/json',body='{}'));reg(pg,'r@x.co');chk('api: 429 -> "Too many attempts"','Too many attempts' in toast(pg));pg.context.close()
    # ---------- 9. layout on real phone shapes
    for w,h in [(320,568),(360,640),(390,844),(412,915),(667,375),(768,1024)]:
        pg=page(w,h);reg(pg,'a@b.co','01712345678')
        for name,sel,last in [('step 1','#authScreen','#authActionBtn'),('step 2','#otpScreen','#otpVerifyBtn'),('step 3','#onboardScreen','#obFinishBtn')]:
            pg.evaluate(f"()=>{{showScreen('{sel[1:]}')}}");pg.evaluate(f"()=>document.querySelector('{last}').scrollIntoView()")
            m=pg.evaluate(f"()=>{{const r=document.querySelector('{last}').getBoundingClientRect();return{{sw:document.documentElement.scrollWidth,iw:innerWidth,top:r.top,bot:r.bottom,ih:innerHeight}}}}")
            chk(f'{w}x{h} {name}: no sideways scroll and main button reachable',m['sw']<=m['iw']+1 and m['top']>=0 and m['bot']<=m['ih']+1,m)
            small=pg.evaluate(f"()=>[...document.querySelectorAll('{sel} button.btn')].filter(b=>b.offsetParent&&b.getBoundingClientRect().height<40).length");chk(f'{w}x{h} {name}: buttons >= 40px tall',small==0,small)
            fs=pg.evaluate(f"()=>Math.min(...[...document.querySelectorAll('{sel} input:not([type=file]):not([type=checkbox]),{sel} select')].filter(e=>e.offsetParent).map(e=>parseFloat(getComputedStyle(e).fontSize)))");chk(f'{w}x{h} {name}: inputs >= 16px (no iOS zoom)',fs>=16,fs)
        chk(f'{w}x{h} no JS errors',not pg.errs,pg.errs);pg.context.close()
    b.close()
print('PASS',len(P),'FAIL',len(F));print('\n'.join('FAIL: '+x for x in F[:30]));sys.exit(1 if F else 0)
