/* BIMO Seller Workspace feature module.
 * Include after bimo-core.js and before </body> in index.html.
 * Business records are stored locally under one account-scoped key.
 */
(() => {
  'use strict';
  if (!window.Bimo || window.__bimoSellerWorkspaceLoaded) return;
  window.__bimoSellerWorkspaceLoaded = true;
  const Bimo = window.Bimo;
  const DEFAULT_THRESHOLD = 5;
  const key = () => `bimo_seller_workspace_${Bimo.accountKeyOf(Bimo.session.active() || {})}`;
  const read = () => Bimo.store.get(key(), { products: [], orders: [], expenses: [] });
  const write = data => Bimo.store.set(key(), data);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => `৳${Number(n || 0).toLocaleString('en-BD')}`;
  const lowProducts = db => db.products.filter(p => Number(p.stock) <= Number(p.lowStock ?? DEFAULT_THRESHOLD));
  const pageNames = ['products','customers','money','assistant'];

  function addStyles() {
    if (document.getElementById('bimoSellerStyles')) return;
    const style = document.createElement('style'); style.id = 'bimoSellerStyles';
    style.textContent = `.seller-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px}.seller-list{display:flex;flex-direction:column;gap:12px}.seller-row{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}.seller-low{border-color:var(--warning)!important}.seller-badge{display:inline-block;padding:4px 9px;border-radius:9px;background:rgba(245,158,11,.16);color:var(--warning);font-size:12px;font-weight:700}.seller-actions{display:flex;gap:8px;flex-wrap:wrap}.seller-actions .btn{width:auto;padding:10px 14px}.seller-empty{color:var(--muted);padding:18px;text-align:center}@media(max-width:850px){.seller-grid{grid-template-columns:1fr 1fr}.navbar{flex-wrap:wrap}.nav-links{order:3;flex-basis:100%;overflow-x:auto;justify-content:flex-start}.nav-actions{gap:5px}.nav-actions .btn-theme{padding:7px}.container{padding:16px 12px}}`;
    document.head.append(style);
  }
  function ensureNavAndPages() {
    const links = document.querySelector('.nav-links'), container = document.querySelector('#appShell .container');
    if (!links || !container) return false;
    pageNames.forEach(name => {
      if (!document.getElementById(`nav-${name}`)) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'nav-item'; button.id = `nav-${name}`;
        button.textContent = ({products:'Products & Stock',customers:'Customers',money:'Money',assistant:'Offline Helper'})[name];
        button.addEventListener('click', () => window.navigateTo?.(name)); links.insertBefore(button, links.querySelector('#nav-settings'));
      }
      if (!document.getElementById(`page-${name}`)) {
        const section = document.createElement('section'); section.id = `page-${name}`; section.className = 'page-section';
        section.innerHTML = `<div class="toolbar"><div><h2>${({products:'Products & Stock',customers:'Customers & Leads',money:'Money',assistant:'Offline Business Helper'})[name]}</h2><p style="color:var(--muted)">Your business records stay on this device.</p></div></div><div id="seller-${name}"></div>`;
        container.insertBefore(section, container.querySelector('#page-settings'));
      }
    });
    const home = document.getElementById('page-home');
    if (home && !document.getElementById('sellerLowStock')) {
      const card = document.createElement('div'); card.className = 'card'; card.id = 'sellerLowStock';
      card.innerHTML = '<h3>Stock running low</h3><div id="sellerLowStockList"></div>';
      home.append(card);
    }
    return true;
  }
  function render() {
    if (!Bimo.session.active() || !ensureNavAndPages()) return;
    addStyles(); const db = read();
    const low = lowProducts(db);
    const warning = document.getElementById('sellerLowStockList');
    if (warning) warning.innerHTML = low.length ? low.map(p => `<div class="seller-row"><span>${esc(p.name)} — ${p.stock} left (alert at ${p.lowStock ?? DEFAULT_THRESHOLD})</span><button class="btn btn-outline" onclick="BimoSellerWorkspace.restock('${esc(p.id)}')">Restock</button></div>`).join('') : '<p class="seller-empty">No products are at their low-stock threshold.</p>';
    renderProducts(db); renderCustomers(db); renderMoney(db); renderHelper(db);
  }
  function renderProducts(db) {
    const root = document.getElementById('seller-products'); if (!root) return;
    root.innerHTML = `<div class="seller-actions"><button class="btn" onclick="BimoSellerWorkspace.addProduct()">+ Add product</button></div><div class="seller-list">${db.products.map(p => `<article class="card ${Number(p.stock)<=Number(p.lowStock??DEFAULT_THRESHOLD)?'seller-low':''}"><div class="seller-row"><strong>${esc(p.name)}</strong>${Number(p.stock)<=Number(p.lowStock??DEFAULT_THRESHOLD)?'<span class="seller-badge">Low stock</span>':''}</div><p>Price ${money(p.price)} · Cost ${money(p.cost)} · Stock ${p.stock} · Alert at ${p.lowStock??DEFAULT_THRESHOLD}</p><div class="seller-actions"><button class="btn btn-outline" onclick="BimoSellerWorkspace.restock('${esc(p.id)}')">Restock</button><button class="btn btn-outline" onclick="BimoSellerWorkspace.setThreshold('${esc(p.id)}')">Set alert level</button><button class="btn btn-outline" onclick="BimoSellerWorkspace.deleteProduct('${esc(p.id)}')">Delete</button></div></article>`).join('')||'<p class="seller-empty">Add your first product to start tracking stock.</p>'}</div>`;
  }
  function renderCustomers(db) {
    const root = document.getElementById('seller-customers'); if (!root) return;
    const customers = {};
    db.orders.forEach(o => { const id=o.phone||o.customer; const c=customers[id]||(customers[id]={name:o.customer,phone:o.phone,count:0,total:0,source:o.source||'Other'}); c.count++; c.total+=Number(o.amount)||0; });
    root.innerHTML = `<div class="seller-list">${Object.values(customers).sort((a,b)=>b.total-a.total).map(c=>`<article class="card"><strong>${esc(c.name)}</strong><p>${esc(c.phone)} · ${c.count} orders · ${money(c.total)} · ${esc(c.source)}</p></article>`).join('')||'<p class="seller-empty">Customer summaries appear as orders are added.</p>'}</div>`;
  }
  function renderMoney(db) {
    const root=document.getElementById('seller-money'); if(!root)return;
    const delivered=db.orders.filter(o=>o.status==='Delivered'); const revenue=delivered.reduce((s,o)=>s+Number(o.amount||0),0); const cost=delivered.reduce((s,o)=>s+Number(o.cost||0),0); const expenses=db.expenses.reduce((s,e)=>s+Number(e.amount||0),0);
    root.innerHTML=`<div class="seller-grid"><article class="card"><h3>Delivered revenue</h3><strong>${money(revenue)}</strong></article><article class="card"><h3>Expenses</h3><strong>${money(expenses)}</strong></article><article class="card"><h3>Estimated profit</h3><strong>${money(revenue-cost-expenses)}</strong></article></div><div class="seller-actions"><button class="btn" onclick="BimoSellerWorkspace.addExpense()">+ Add expense</button><button class="btn btn-outline" onclick="BimoSellerWorkspace.exportBackup()">Export business backup</button><label class="btn btn-outline">Import backup<input type="file" accept="application/json" onchange="BimoSellerWorkspace.importBackup(event)" hidden></label></div><div class="seller-list">${db.expenses.map(e=>`<article class="card seller-row"><span>${esc(e.type)} · ${esc(e.note||'')} · ${esc(e.date)}</span><strong>${money(e.amount)}</strong></article>`).join('')}</div>`;
  }
  function renderHelper(db) {
    const root=document.getElementById('seller-assistant'); if(!root)return;
    root.innerHTML=`<article class="card"><p>This helper works locally with your saved records; it does not call an AI provider.</p><textarea id="sellerHelperQuestion" rows="2" placeholder="Ask about profit, stock, pending orders, or backup"></textarea><button class="btn" onclick="BimoSellerWorkspace.askHelper()">Ask</button><div id="sellerHelperAnswer" aria-live="polite"></div></article><article class="card"><h3>Paste a customer message</h3><textarea id="sellerPaste" rows="5" placeholder="Paste a WhatsApp, Facebook, or Instagram order message"></textarea><button class="btn btn-outline" onclick="BimoSellerWorkspace.parseMessage()">Review extracted order</button><div id="sellerParsed"></div></article>`;
  }
  function save(db){if(!write(db)){alert('Could not save. Device storage may be full.');return false;} render();return true;}
  const api = {
    addProduct(){const name=prompt('Product name');if(!name?.trim())return;const price=Number(prompt('Selling price (BDT)','0'));const cost=Number(prompt('Unit cost (BDT)','0'));const stock=Number(prompt('Starting stock','0'));const lowStock=Number(prompt('Low-stock alert threshold',String(DEFAULT_THRESHOLD)));if(!(price>0)||stock<0||lowStock<0)return alert('Enter valid price, stock, and threshold.');const db=read();db.products.push({id:crypto.randomUUID?.()||String(Date.now()),name:name.trim(),price,cost:Math.max(cost,0),stock,lowStock,createdAt:Date.now()});save(db);},
    restock(id){const db=read(),p=db.products.find(x=>String(x.id)===String(id));if(!p)return;const qty=Number(prompt(`Add quantity for ${p.name}`,'1'));if(!(qty>0))return;p.stock=Number(p.stock)+qty;save(db);},
    setThreshold(id){const db=read(),p=db.products.find(x=>String(x.id)===String(id));if(!p)return;const value=Number(prompt('Alert when stock is at or below',String(p.lowStock??DEFAULT_THRESHOLD)));if(!Number.isFinite(value)||value<0)return;p.lowStock=value;save(db);},
    deleteProduct(id){if(!confirm('Delete this product? Historical order records will remain.'))return;const db=read();db.products=db.products.filter(p=>String(p.id)!==String(id));save(db);},
    addExpense(){const amount=Number(prompt('Expense amount (BDT)'));if(!(amount>0))return;const type=prompt('Expense category (Ads, Delivery, Packaging, Salary, Other)','Other')||'Other';const note=prompt('Note (optional)')||'';const db=read();db.expenses.unshift({id:Date.now(),date:new Date().toISOString().slice(0,10),type,amount,note});save(db);},
    askHelper(){const q=document.getElementById('sellerHelperQuestion')?.value.toLowerCase()||'',db=read(),del=db.orders.filter(o=>o.status==='Delivered'),profit=del.reduce((s,o)=>s+Number(o.amount||0)-Number(o.cost||0),0)-db.expenses.reduce((s,e)=>s+Number(e.amount||0),0);let answer='Try asking about profit, stock, pending orders, or backup.';if(/profit|লাভ/.test(q))answer=`Estimated profit from delivered orders: ${money(profit)}`;else if(/stock|স্টক/.test(q)){const low=lowProducts(db);answer=low.length?low.map(p=>`${p.name}: ${p.stock} left`).join('\n'):'No products are at their alert threshold.';}else if(/pending|due/.test(q)){const pending=db.orders.filter(o=>!['Delivered','Cancelled','Returned'].includes(o.status));answer=`${pending.length} open orders · ${money(pending.reduce((s,o)=>s+Number(o.amount||0),0))}`;}else if(/backup/.test(q))answer='Open Settings → Data & Backup to export a full local business backup.';document.getElementById('sellerHelperAnswer').textContent=answer;},
    parseMessage(){const text=document.getElementById('sellerPaste')?.value||'';const phone=(text.match(/(?:\+?88)?0?1[3-9]\d[\s-]?\d{3}[\s-]?\d{4}/)||[])[0]||'';const amountMatch=text.match(/(?:৳|tk\.?|taka|bdt)\s*([\d,]+)/i)||text.match(/([\d,]+)\s*(?:৳|tk|taka|bdt)/i);const amount=amountMatch?Number(amountMatch[1].replace(/,/g,'')):0;document.getElementById('sellerParsed').textContent=`Review only — no order was saved. Phone: ${phone||'not found'}; amount: ${amount?money(amount):'not found'}. Add/edit the order in Orders after checking the message.`;},
    exportBackup(){const db=read(),payload={bimoSellerWorkspace:1,version:1,exportedAt:new Date().toISOString(),data:db};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));a.download='bimo-business-backup.json';a.click();URL.revokeObjectURL(a.href);},
    importBackup(event){const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const backup=JSON.parse(reader.result);if(backup.bimoSellerWorkspace!==1||!backup.data||!Array.isArray(backup.data.products)||!Array.isArray(backup.data.orders)||!Array.isArray(backup.data.expenses))throw new Error('Unsupported or invalid backup.');if(!confirm('Restore this backup and replace this workspace’s products, orders, and expenses? Export your current data first if you need to keep it.'))return;save({products:backup.data.products,orders:backup.data.orders,expenses:backup.data.expenses});}catch(e){alert(e.message||'Could not read the backup.');}finally{event.target.value='';}};reader.readAsText(file);}
  };
  window.BimoSellerWorkspace = api;
  function start(){if(!Bimo.session.active())return;render();}
  const observer=new MutationObserver(start);const shell=document.getElementById('appShell');if(shell)observer.observe(shell,{attributes:true,attributeFilter:['class']});
  window.addEventListener('bimo:workspace-updated',render);document.addEventListener('DOMContentLoaded',start);setTimeout(start,0);
})();
