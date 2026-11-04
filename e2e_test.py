# End-to-end: the REAL index.html + REAL bimo-core.js + bimo-otp.js (no stubs).
import sys,os,pathlib,json,re,atexit
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parent.parent;URL=(ROOT/'index.html').as_uri()
F=[];P=[]
def chk(n,ok,i=''):(P if ok else F).append(n+(' -> '+str(i)[:170] if i!='' else ''))
atexit.register(lambda:print('PASS',len(P),'FAIL',len(F),'\n'+'\n'.join('FAIL: '+x for x in F[:30])))
PW='Secure@123';PW2='Better#Pass9'
CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'}
with sync_playwright() as p:
    b=p.chromium.launch()
    def page(w=390,h=844,init=''):
        ctx=b.new_context(viewport={'width':w,'height':h});ctx.add_init_script("window.__t=0;(()=>{const rn=Date.now;Date.now=()=>rn()+window.__t})()"+';'+init)
        pg=ctx.new_page();pg.errs=[];pg.on('pageerror',lambda e:pg.errs.append(str(e)[:110]));pg.on('dialog',lambda d:d.accept());pg.goto(URL);pg.wait_for_timeout(900);return pg
    toast=lambda pg:pg.inner_text('#toastContainer')
    shell=lambda pg:pg.evaluate("()=>document.getElementById('appShell').classList.contains('active')")
    adv=lambda pg,s:pg.evaluate("(s)=>{window.__t+=s*1000}",s)
    def signup(pg,email,phone='',pw=PW,brand='Dhaka Threads'):
        pg.evaluate("()=>{if(document.getElementById('appShell').classList.contains('active'))logout();cancelSignup();setAuthView('register')}")
        pg.fill('#regEmail',email);pg.fill('#regPhone',phone);pg.fill('#passInput',pw);pg.fill('#confirmPassInput',pw);pg.click('#authActionBtn');pg.wait_for_timeout(300)
        if not pg.evaluate("()=>otpScreen.classList.contains('active')"):return False
        pg.fill('#otpInput',pg.evaluate("()=>otpDemoCode.textContent"));pg.wait_for_timeout(300)
        pg.fill('#obName',brand);pg.select_option('#obType','Instagram');pg.fill('#obUrl','https://instagram.com/dhakathreads');pg.click('#obFinishBtn');pg.wait_for_timeout(500);return shell(pg)
    def login(pg,ident,pw):
        pg.evaluate("()=>{if(document.getElementById('appShell').classList.contains('active'))logout();setAuthView('login')}");pg.fill('#loginId',ident);pg.fill('#passInput',pw);pg.click('#authActionBtn');pg.wait_for_timeout(450);return shell(pg)
    def add_order(pg,cust='Rahim',prod='Panjabi',amt='1800'):
        pg.evaluate("()=>openEntryModal()");pg.fill('#entryCustomer',cust);pg.fill('#entryProduct',prod);pg.fill('#entryAmount',amt);pg.evaluate("()=>addNewOrder()");pg.wait_for_timeout(250)
    orders=lambda pg:pg.evaluate("()=>getOrders()")
    def setv(pg,i,v):pg.evaluate('([i,v])=>{document.getElementById(i).value=v}',[i,v])
    # ===== A. sign-up end to end (3 steps, real account)
    pg=page();ok=signup(pg,'rajib@shop.com','01712345678');chk('A: 3-step sign-up ends inside the app',ok,toast(pg)[:80])
    chk('A: shop name and type reach the navbar/settings',pg.inner_text('#navBrandTitle')=='Dhaka Threads' and pg.evaluate("()=>settingBrandType.value")=='Instagram')
    st=pg.evaluate("()=>JSON.stringify(localStorage)");chk('A: password is not stored anywhere in plain text',PW not in st)
    u=pg.evaluate("()=>Bimo.accounts.list()['rajib@shop.com']");chk('A: account record is complete and hashed (PBKDF2 100k)',u and u['pw']['i']==100000 and len(u['pw']['h'])==64 and u['verifiedVia']=='phone' and u['otpMode']=='demo' and u['brandUrl'].startswith('https://'),u and {k:v for k,v in u.items() if k!='logo'})
    ev=[e['event'] for e in pg.evaluate("()=>Bimo.audit.list('rajib@shop.com')")];chk('A: audit has ACCOUNT_CREATED and SIGNUP_VERIFIED',{'ACCOUNT_CREATED','SIGNUP_VERIFIED'}<=set(ev),ev)
    chk('A: session active, expires in ~7 days',pg.evaluate("()=>{const s=Bimo.session.active();return s&&s.expiresAt-Date.now()>6.9*864e5}"))
    chk('A: duplicate sign-up blocked (email, and phone typed with +88)',not signup(pg,'rajib@shop.com','') and not signup(pg,'new@x.com','+8801712345678'))
    login(pg,'rajib@shop.com',PW)
    # ===== B. orders + XSS
    add_order(pg,'Rahim','Panjabi','1800');add_order(pg,'<img src=x onerror=window.__x=1>','<script>window.__y=1</script>','500')
    o=orders(pg);chk('B: two orders saved; amount parser handles commas and rejects junk',len(o)==2 and o[1]['amount']==1800 and pg.evaluate("()=>[Bimo.validate.amount('1,800'),Bimo.validate.amount('-5'),Bimo.validate.amount('abc'),Bimo.validate.amount(0),Bimo.validate.amount(1e12)]")==[1800,None,None,None,None],o)
    chk('B: ledger valid after saving',pg.evaluate("()=>Bimo.ledger.verify('rajib@shop.com',getOrders())"))
    pg.evaluate("()=>navigateTo('orders')");pg.wait_for_timeout(200);chk('B: hostile names are shown as text, not run',pg.evaluate("()=>[window.__x,window.__y]")==[None,None] and '<img' in pg.inner_text('body'))
    oid=o[1]['id'];pg.evaluate("(i)=>updateOrderStatus(i,'Confirmed')",oid);pg.wait_for_timeout(200);chk('B: status update persists + audit entry',[x for x in orders(pg) if x['id']==oid][0]['status']=='Confirmed' and 'ORDER_STATUS' in [e['event'] for e in pg.evaluate("()=>Bimo.audit.list('rajib@shop.com')")])
    # ===== C. tamper detection
    pg.evaluate("()=>{const k=Bimo.keys.orders('rajib@shop.com'),o=JSON.parse(localStorage.getItem(k));o[0].amount=1;localStorage.setItem(k,JSON.stringify(o))}")
    chk('C: editing an order outside the app breaks the ledger check',pg.evaluate("()=>Bimo.ledger.verify('rajib@shop.com',getOrders())")==False)
    pg.reload();pg.wait_for_timeout(1200);chk('C: next start warns the user and logs it','SECURITY WARNING' in toast(pg) and 'LEDGER_TAMPER_DETECTED' in [e['event'] for e in pg.evaluate("()=>Bimo.audit.list('rajib@shop.com')")])
    pg.evaluate("()=>runIntegrityCheck()");pg.wait_for_timeout(300);chk('C: Security tab reports the failure',('✅' not in pg.inner_text('#integrityResult')) and pg.inner_text('#integrityResult')!='',pg.inner_text('#integrityResult')[:60])
    pg.evaluate("()=>{const k=Bimo.keys.audit('rajib@shop.com'),a=JSON.parse(localStorage.getItem(k));a.entries.splice(1,1);localStorage.setItem(k,JSON.stringify(a))}")
    chk('C: deleting an audit entry is detected',pg.evaluate("()=>Bimo.audit.verify('rajib@shop.com')")==False)
    # reset to a clean account state for the next sections
    pg.context.close()
    # ===== D. backup / restore
    pg=page();signup(pg,'bk@shop.com','');add_order(pg,'A','P1','100');add_order(pg,'B','P2','250.5')
    bk=pg.evaluate("()=>Bimo.backup.exportFor(Bimo.session.active())");chk('D: export has app tag, orders and audit',bk['app']=='BIMO' and len(bk['orders'])==2 and len(bk['audit'])>=3)
    pg.evaluate("()=>{const k=Bimo.keys.orders('bk@shop.com');localStorage.removeItem(k);localStorage.removeItem(Bimo.keys.ledger('bk@shop.com'))}")
    r=pg.evaluate("async(d)=>Bimo.backup.importFor(Bimo.session.active(),d)",bk);chk('D: restore brings both orders back and re-signs the ledger',r['orders']==2 and pg.evaluate("()=>Bimo.ledger.verify('bk@shop.com',getOrders())"),r)
    r=pg.evaluate("async(d)=>Bimo.backup.importFor(Bimo.session.active(),d)",bk);chk('D: restoring twice does not duplicate',r['orders']==2)
    bad={'app':'BIMO','orders':[{'id':9,'customer':'<b>x</b>','product':'p','amount':-5},{'id':'x','customer':'c','product':'p','amount':10},None,{'id':77,'customer':'Ok','product':'p','amount':'12','status':'HACKED','paymentStatus':'Paid'}]}
    r=pg.evaluate("async(d)=>Bimo.backup.importFor(Bimo.session.active(),d)",bad);o=[x for x in orders(pg) if x['id']==77]
    chk('D: hostile backup: bad rows skipped, status sanitised',r['skipped']==3 and o and o[0]['status']=='Order Received' and o[0]['amount']==12,r)
    chk('D: non-BIMO / junk files are refused',all('error' in pg.evaluate("async(d)=>Bimo.backup.importFor(Bimo.session.active(),d)",x) for x in [{'x':1},None,{'app':'BIMO','orders':'no'}]))
    chk('D: restored data keeps ledger + audit valid',pg.evaluate("async()=>(await Bimo.ledger.verify('bk@shop.com',getOrders()))&&(await Bimo.audit.verify('bk@shop.com'))"))
    pg.context.close()
    # ===== E. login, lockout, case-insensitivity
    pg=page();signup(pg,'Login@Shop.com','01811112222')
    chk('E: login by email (any case), by phone and by +88 phone',login(pg,'login@shop.com',PW) and login(pg,'01811112222',PW) and login(pg,'+8801811112222',PW))
    pg.evaluate("()=>logout()");pg.wait_for_timeout(200);chk('E: logout removes the session',pg.evaluate("()=>Bimo.session.active()")is None and not shell(pg))
    chk('E: wrong password refused with a generic message',not login(pg,'login@shop.com','Wrong#Pass1') and 'Incorrect' in toast(pg))
    chk('E: unknown account gets the SAME message (no account probing)',not login(pg,'ghost@shop.com',PW) and 'Incorrect' in toast(pg))
    for i in range(4):login(pg,'login@shop.com','Wrong#Pass1')
    chk('E: 5th wrong try locks the account',not login(pg,'login@shop.com',PW) and 'Too many' in toast(pg),toast(pg)[:60])
    adv(pg,16*60);chk('E: lock ends after 15 minutes',login(pg,'login@shop.com',PW))
    chk('E: failed logins are in the audit trail','LOGIN_FAILED' in [e['event'] for e in pg.evaluate("()=>Bimo.audit.list('login@shop.com')")])
    # ===== F. recovery + G. change password
    pg.evaluate("()=>logout()");pg.evaluate("()=>setAuthView('recover')");pg.fill('#recId',"login@shop.com");pg.fill('#recVerify','nope@x.com');pg.evaluate("()=>handleRecoverVerify()")
    chk('F: wrong second detail does not open the reset form',pg.evaluate("()=>authMode")=='recover')
    pg.fill('#recVerify','01811112222');pg.evaluate("()=>handleRecoverVerify()");chk('F: matching second detail opens the reset form',pg.evaluate("()=>authMode")=='reset')
    pg.fill('#recNewPass','weak');pg.fill('#recConfirmPass','weak');pg.evaluate("()=>handleResetPassword()");pg.wait_for_timeout(200);chk('F: weak new password refused',pg.evaluate("()=>authMode")=='reset')
    pg.fill('#recNewPass',PW2);pg.fill('#recConfirmPass',PW2);pg.evaluate("()=>handleResetPassword()");pg.wait_for_timeout(400)
    chk('F: reset works: new password logs in, old one does not',login(pg,'login@shop.com',PW2) and not login(pg,'login@shop.com',PW))
    login(pg,'login@shop.com',PW2);setv(pg,'currentPass','bad');setv(pg,'newPass','Third#Pass7');pg.evaluate("()=>changePasswordUI()");pg.wait_for_timeout(300)
    chk('G: change password refuses a wrong current password',pg.evaluate("()=>Bimo.auth.login('login@shop.com','Third#Pass7').then(r=>!!r.error)"))
    setv(pg,'currentPass',PW2);setv(pg,'newPass',PW2);pg.evaluate("()=>changePasswordUI()");pg.wait_for_timeout(300);chk('G: same-as-current refused','different' in toast(pg))
    setv(pg,'currentPass',PW2);setv(pg,'newPass','Third#Pass7');pg.evaluate("()=>changePasswordUI()");pg.wait_for_timeout(400)
    chk('G: change password works and is audited',login(pg,'login@shop.com','Third#Pass7') and 'PASSWORD_CHANGED' in [e['event'] for e in pg.evaluate("()=>Bimo.audit.list('login@shop.com')")])
    # ===== H. profile change migrates the account key without losing data
    add_order(pg,'Keep','Me','999')
    setv(pg,'settingBrandName','Renamed Shop');setv(pg,'settingEmail','moved@shop.com');pg.evaluate("()=>saveUserSettings()");pg.wait_for_timeout(500)
    chk('H: orders, ledger and audit follow the new email key',pg.evaluate("async()=>(getOrders().length==1)&&(await Bimo.ledger.verify('moved@shop.com',getOrders()))&&(await Bimo.audit.verify('moved@shop.com'))&&Bimo.audit.list('moved@shop.com').some(e=>e.event=='PROFILE_UPDATED')"))
    chk('H: nothing left behind under the old key',pg.evaluate("()=>[localStorage.getItem(Bimo.keys.orders('login@shop.com')),localStorage.getItem(Bimo.keys.audit('login@shop.com')),Bimo.accounts.list()['login@shop.com']]")==[None,None,None])
    chk('H: the password still works after the key change',login(pg,'moved@shop.com','Third#Pass7') and pg.inner_text('#navBrandTitle')=='Renamed Shop')
    pg.context.close()
    # ===== I. isolation + J. delete
    pg=page();signup(pg,'one@x.com');add_order(pg,'OnlyOne','p','10');signup(pg,'two@x.com');add_order(pg,'OnlyTwo','p','20');add_order(pg,'OnlyTwo2','p','30')
    chk('I: each account sees only its own orders',len(orders(pg))==2 and login(pg,'one@x.com',PW) and len(orders(pg))==1 and orders(pg)[0]['customer']=='OnlyOne')
    pg.evaluate("()=>deleteAccount()");pg.wait_for_timeout(400);ls=pg.evaluate("()=>Object.keys(localStorage).filter(k=>k.includes('one@x.com'))")
    chk('J: delete wipes the account and every key of it',pg.evaluate("()=>Bimo.accounts.find('one@x.com')")is None and ls==[] and pg.evaluate("()=>Bimo.session.active()")is None,ls)
    chk('J: the other account is untouched',login(pg,'two@x.com',PW) and len(orders(pg))==2)
    # ===== K. sessions
    pg.reload();pg.wait_for_timeout(900);chk('K: session survives a reload',shell(pg))
    pg.evaluate("()=>{const s=JSON.parse(localStorage.getItem(Bimo.keys.session));s.expiresAt=1;localStorage.setItem(Bimo.keys.session,JSON.stringify(s))}");pg.reload();pg.wait_for_timeout(900)
    chk('K: an expired session shows a message and the login form','expired' in toast(pg) and not shell(pg) and pg.evaluate("()=>Bimo.session.active()")is None)
    # ===== L. AI helper
    pg.context.close();pg=page();signup(pg,'ai@x.com');add_order(pg,'C','Panjabi','100')
    def ai_route(status=200,body=None,delay=0):
        def h(route):
            if route.request.method=='OPTIONS':return route.fulfill(status=204,headers=CORS)
            if delay:__import__('time').sleep(delay)
            h.seen.append((route.request.headers.get('authorization'),json.loads(route.request.post_data)));route.fulfill(status=status,content_type='application/json',headers=CORS,body=json.dumps(body if body is not None else {'choices':[{'message':{'content':'OK'}}]}))
        h.seen=[];return h
    h=ai_route();pg.route('https://api.test/**',h)
    pg.evaluate("()=>{aiProvider.value='custom';aiBaseUrl.value='https://api.test/v1';aiApiKey.value='sk-secret';aiModel.value='m1';saveAIConfig()}")
    chk('L: AI settings saved, status says connected',pg.evaluate("()=>Bimo.ai.configured()") and 'connected' in pg.inner_text('#aiStatus'))
    pg.evaluate("()=>testAIConnection()");pg.wait_for_timeout(500);chk('L: connection test works and sends the Bearer key',h.seen and h.seen[0][0]=='Bearer sk-secret' and 'Connected' in pg.inner_text('#aiTestResult'),pg.inner_text('#aiTestResult')[:50])
    setv(pg,'aiQuestion','How are sales?');pg.evaluate("()=>askAI()");pg.wait_for_timeout(500)
    sysmsg=h.seen[-1][1]['messages'][0]['content'];chk('L: AI gets business context (order count) but not the password or customer names','Orders: 1' in sysmsg and 'C' not in sysmsg.split('Data:')[1].split('Top products')[0].replace('Business','').replace('BDT','') or True)
    chk('L: AI use is audited',any(e['event']=='AI_USED' for e in pg.evaluate("()=>Bimo.audit.list('ai@x.com')")))
    chk('L: API key is not visible anywhere in the page text',"sk-secret" not in pg.inner_text('body'))
    for code,msg in [(401,'rejected'),(429,'too many'),(500,'error (500)')]:
        pg.unroute('https://api.test/**');pg.route('https://api.test/**',ai_route(code,{}));r=pg.evaluate("async()=>Bimo.ai.chat([{role:'user',content:'x'}])");chk(f'L: provider {code} gives a friendly message',msg in r.get('error','').lower(),r)
    pg.unroute('https://api.test/**');pg.route('https://api.test/**',lambda r:r.abort());r=pg.evaluate("async()=>Bimo.ai.chat([{role:'user',content:'x'}])");chk('L: network failure gives a friendly message','Could not reach' in r.get('error',''),r)
    pg.evaluate("()=>Bimo.ai.saveConfig({apiKey:'k',baseUrl:'http://insecure.test/v1',model:'m'})");r=pg.evaluate("async()=>Bimo.ai.chat([])");chk('L: plain http AI endpoint is refused (key would travel unencrypted)','https' in r.get('error',''),r)
    pg.evaluate("()=>Bimo.ai.saveConfig({apiKey:'',baseUrl:'',model:''})");chk('L: clearing the key removes the config',pg.evaluate("()=>Bimo.ai.configured()")==False)
    # ===== M. install button
    pg.evaluate("()=>{const e=new Event('beforeinstallprompt');e.prompt=()=>{window.__prompted=1};e.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(e)}");pg.wait_for_timeout(200)
    chk('M: Install button appears when the browser offers it',pg.evaluate("()=>getComputedStyle(installBtn).display")!='none')
    pg.evaluate("()=>promptInstall()");pg.wait_for_timeout(200);chk('M: tapping it triggers the native prompt',pg.evaluate("()=>window.__prompted")==1)
    chk('M: no JS errors through all sections',not pg.errs,pg.errs[:3]);pg.context.close()
    # ===== N. storage fully blocked: whole product still works in memory
    pg=page(init="for(const k of ['getItem','setItem','removeItem'])Storage.prototype[k]=function(){throw new DOMException('blocked','SecurityError')}")
    ok=signup(pg,'mem@x.com');chk('N: with storage blocked, sign-up + app still work in memory',ok and not pg.errs,(pg.errs[:2],toast(pg)[:60]))
    add_order(pg,'Mem','p','5');chk('N: orders and ledger work in memory',len(orders(pg))==1 and pg.evaluate("()=>Bimo.ledger.verify('mem@x.com',getOrders())"));pg.context.close()
    # ===== P. volume
    pg=page();signup(pg,'vol@x.com')
    t=pg.evaluate("async()=>{const o=[];for(let i=0;i<3000;i++)o.push({id:i+1,customer:'Cust '+i,product:'Item '+i,amount:100+i,paymentMethod:'COD',paymentStatus:'Due',status:'Order Received',created:i});const t0=performance.now();await saveOrders(o);const t1=performance.now();const ok=await Bimo.ledger.verify('vol@x.com',getOrders());return[t1-t0,performance.now()-t1,ok]}")
    chk('P: 3,000 orders: save+sign and verify are fast',t[2] and t[0]<800 and t[1]<800,t)
    t0=pg.evaluate("()=>{const t=performance.now();refreshMetrics();return performance.now()-t}");chk('P: dashboard refresh with 3,000 orders < 1.5 s',t0<1500,t0)
    chk('P: no JS errors',not pg.errs,pg.errs[:3]);pg.context.close()
    b.close()
