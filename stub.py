# Stand-in for the real bimo-core.js: only the parts the sign-up flow touches. Everything else is a permissive no-op.
STUB = """(()=>{const rn=Date.now;window.__t=0;Date.now=()=>rn()+window.__t;
const deep=()=>new Proxy(function(){},{get:(t,k)=>k===Symbol.toPrimitive?()=>'':deep(),apply:()=>deep()});
window.__existing=[];window.__creates=[];window.__createErr=null;window.__audit=[];
const base={validate:{email:e=>/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(e),phone:p=>/^\\+?\\d{6,15}$/.test(p),url:u=>!u||/^https?:\\/\\//.test(u),password:p=>p.length<8?'Password too short':null,text:s=>s},
 accounts:{create:async x=>{window.__creates.push(x);return window.__createErr?{error:window.__createErr}:{user:{email:x.email,phone:x.phone,brandName:x.brandName}}},find:id=>window.__existing.includes(id)?{id}:null},
 auth:{login:async(i,p)=>({error:'stub'})},session:{active:()=>null,start:u=>u},accountKeyOf:u=>'k',audit:{log:(...a)=>window.__audit.push(a)}};
window.Bimo=new Proxy(base,{get:(t,k)=>k in t?t[k]:deep()})})()"""
