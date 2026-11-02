"""Phase 3 UI checks. Runs the real app in Chromium against a tiny in-memory stand-in for the Supabase REST API.
Dev tool (needs Python Playwright); not part of CI.   python3 tests/ui/phase3_ui.py"""
import functools, http.server, json, os, re, socketserver, sys, threading, urllib.parse
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(ROOT)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT)); PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:%d/index.html' % PORT
UID, ADM = '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000ad'
results = []
def tap(pg, sel):
    pg.wait_for_timeout(520)   # the app ignores taps closer than 450 ms (double-tap guard), like a real finger
    pg.click(sel)
def settle(pg, extra=700):
    try: pg.wait_for_load_state('networkidle', timeout=10000)
    except Exception: pass
    pg.wait_for_timeout(extra)
def check(label, ok, extra=''):
    results.append(bool(ok)); print(('PASS  ' if ok else 'FAIL  ') + label + ((' [' + str(extra) + ']') if (extra and not ok) else ''))

class Backend:
    def __init__(self, uid, role):
        self.uid, self.role, self.calls = uid, role, []
        self.stores, self.priv, self.apps, self.prods, self.pp, self.notes = [], {}, {}, [], {}, []
        self.profiles = {uid: {'id': uid, 'name': 'Ada Obi', 'email': 'ada@test.local', 'phone': '0801', 'country': 'NG', 'role': role}}
    def slug(self, n): return re.sub(r'(^-|-$)', '', re.sub(r'[^a-z0-9]+', '-', n.lower())) or 'store'
    def store_view(self, s, emb=True):
        o = dict(s)
        if emb: o['store_applications'] = self.apps.get(s['id']); o['store_private'] = self.priv.get(s['id'])
        return o
    def handle(self, route):
        req = route.request; u = urllib.parse.urlparse(req.url); path = u.path.replace('/rest/v1/', ''); qs = urllib.parse.parse_qs(u.query)
        body = json.loads(req.post_data) if req.post_data else None; m = req.method
        self.calls.append((m, path, qs, body))
        def ok(v, code=200): route.fulfill(status=code, content_type='application/json', headers={'access-control-allow-origin': '*'}, body=json.dumps(v))
        eq = lambda k: (qs.get(k, [''])[0] or '').replace('eq.', '', 1) if qs.get(k, [''])[0].startswith('eq.') else None
        if path.startswith('rpc/'):
            fn = path[4:]
            if fn == 'next_slug': return ok(self.slug(body['p_name']))
            if fn == 'submit_store':
                for s in self.stores:
                    if s['id'] == body['p_store']: s['status'] = 'pending'
                return ok(None)
            if fn in ('approve_store', 'reject_store'):
                for s in self.stores:
                    if s['id'] == body['p_store']: s['status'] = 'approved' if fn == 'approve_store' else 'rejected'
                    if fn == 'reject_store': self.priv.setdefault(body['p_store'], {})['status_note'] = body['p_reason']
                return ok(None)
            if fn == 'review_product':
                for p in self.prods:
                    if p['id'] == body['p_product']: p['status'] = 'published' if body['p_decision'] == 'publish' else 'rejected'
                    if body['p_decision'] == 'reject': self.pp[body['p_product']] = {'product_id': body['p_product'], 'review_note': body['p_note']}
                return ok(None)
            return ok(None)
        if path.startswith('public_stores'): return ok([self.store_view(s, False) for s in self.stores if s['status'] == 'approved'])
        if path.startswith('stores'):
            if m == 'POST':
                row = dict(body, id='st%d' % (len(self.stores) + 1), slug=self.slug(body['name']), created_at='2026-11-02T10:00:00Z', is_official=False, categories=[], logo_url=None, cover_url=None)
                self.stores.append(row); return ok([row], 201)
            if m == 'PATCH':
                for s in self.stores:
                    if s['id'] == eq('id'): s.update(body); return ok([s])
                return ok([])
            res = list(self.stores)
            if eq('owner_id'): res = [s for s in res if s.get('owner_id') == eq('owner_id')]
            if qs.get('status', [''])[0].startswith('eq.'): res = [s for s in res if s['status'] == qs['status'][0][3:]]
            return ok([self.store_view(s) for s in res])
        for tbl, db in (('store_private', self.priv), ('store_applications', self.apps)):
            if path.startswith(tbl):
                key = 'store_id'
                if m == 'POST': db[body[key]] = dict(body); return ok([db[body[key]]], 201)
                if m == 'PATCH': db.setdefault(eq(key), {}).update(body); return ok([db[eq(key)]])
                return ok([db[eq(key)]] if eq(key) in db else [])
        if path.startswith('product_private'):
            if m == 'POST': self.pp[body['product_id']] = dict(body); return ok([body], 201)
            if m == 'PATCH': self.pp.setdefault(eq('product_id'), {}).update(body); return ok([self.pp[eq('product_id')]])
            return ok(list(self.pp.values()))
        if path.startswith('products'):
            if m == 'POST':
                row = dict(body, id='pr%d' % (len(self.prods) + 1), at=1790000000000 + len(self.prods), desc=body.get('descr'), images=body.get('images', []), img=body.get('img')); self.prods.append(row); return ok([row], 201)
            if m == 'PATCH':
                for p in self.prods:
                    if p['id'] == eq('id'): p.update(body); return ok([p])
                return ok([])
            res = list(self.prods)
            if eq('store_id'): res = [p for p in res if p['store_id'] == eq('store_id')]
            if qs.get('status', [''])[0].startswith('eq.'): res = [p for p in res if p['status'] == qs['status'][0][3:]]
            elif 'select' in qs and 'stores(' not in qs['select'][0] and not eq('store_id'): res = [p for p in res if p['status'] == 'published']
            out = []
            for p in res:
                o = dict(p)
                if 'stores(' in qs.get('select', [''])[0]:
                    st = next((s for s in self.stores if s['id'] == p['store_id']), {}); o['stores'] = {'name': st.get('name'), 'slug': st.get('slug')}; o['product_private'] = self.pp.get(p['id'])
                out.append(o)
            return ok(out)
        if path.startswith('profiles'):
            ids = re.findall(r'[0-9a-f-]{36}', qs.get('id', [''])[0]) or [self.uid]
            return ok([self.profiles[i] for i in ids if i in self.profiles])
        if path.startswith('notifications'): return ok(self.notes)
        if path.startswith('collections'): return ok([{'id': 'c1', 'name': 'Womens Bags', 'grp': 'Fashion', 'at': 1}, {'id': 'c2', 'name': 'Skin Care', 'grp': 'Beauty', 'at': 2}, {'id': 'c3', 'name': 'Kitchen Accessories', 'grp': 'Home', 'at': 3}])
        return ok([])

def new_page(p, uid=None, role='customer', backend=None):
    b = backend or Backend(uid or UID, role)
    ctx = p.chromium.launch().new_context(viewport={'width': 390, 'height': 844})
    ctx.route('**/rest/v1/**', b.handle); ctx.route('**/auth/v1/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
    ctx.route('**/functions/v1/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}')); ctx.route('**/open.er-api.com/**', lambda r: r.abort())
    pg = ctx.new_page(); pg.errors = []
    pg.add_init_script("localStorage.setItem('en_onb','1')")
    pg.on('pageerror', lambda e: pg.errors.append(str(e)))
    if uid:
        pg.add_init_script("localStorage.setItem('en_sess',JSON.stringify({access_token:'t',refresh_token:'r',expires_at:Date.now()+36e5,uid:'%s'}));localStorage.setItem('en_user',JSON.stringify({id:'%s',name:'Ada Obi',email:'ada@test.local',country:'NG',admin:%s}));localStorage.setItem('en_onb','1')" % (uid, uid, 'true' if role == 'admin' else 'false'))
    return pg, b

with sync_playwright() as p:
    # ---- 1. Shoppers see who sells what -------------------------------------------------------------------------
    b = Backend(None, 'customer'); b.stores = [{'id': 'st1', 'owner_id': 'o', 'slug': 'urban-finds', 'name': 'Urban Finds', 'tagline': 'Bags from Lagos', 'about': 'Handmade bags.', 'city': 'Ikeja', 'state': 'Lagos', 'status': 'approved', 'is_official': False, 'created_at': '2025-03-01T00:00:00Z', 'logo_url': None, 'cover_url': None},
                                              {'id': 'everneed-official', 'owner_id': None, 'slug': 'everneed', 'name': 'EverNeed', 'status': 'approved', 'is_official': True, 'created_at': '2024-01-01T00:00:00Z'}]
    base = {'col': 'Womens Bags', 'old': 0, 'stock': 5, 'stocks': {}, 'cty': [], 'img': None, 'images': [], 'sizes': [], 'axes': [], 'desc': 'Nice', 'descr': 'Nice'}
    b.prods = [dict(base, id='pa', name='Linen tote', price=12500, store_id='st1', status='published', at=1790000000001), dict(base, id='pb', name='Mug set', price=6500, store_id='everneed-official', status='published', at=1790000000002),
               dict(base, id='pc', name='Hidden draft', price=999, store_id='st1', status='draft', at=1790000000003)]
    pg, _ = new_page(p, None, backend=b); pg.goto(BASE + '#/'); settle(pg)
    t = pg.inner_text('body')
    check('home cards show the seller name', 'Urban Finds' in t and 'EverNeed' in t)
    check('the customer feed hides draft products', 'Hidden draft' not in t)
    tap(pg, '.seller-row:has-text("Urban Finds")'); pg.wait_for_timeout(900)
    check('tapping the seller chip opens the store page', pg.evaluate('location.hash') == '#/store/urban-finds')
    t = pg.inner_text('body')
    check('store page shows name, place, about and only that store\'s products', all(x in t for x in ['Urban Finds', 'Ikeja, Lagos', 'Handmade bags.', 'Linen tote']) and 'Mug set' not in t and 'Hidden draft' not in t)
    pg.goto(BASE + '#/p/pa'); settle(pg); t = pg.inner_text('body')
    check('product page has a "Sold by" link to the store', 'Sold by' in t and pg.locator('a.soldby[href="#/store/urban-finds"]').count() == 1)
    pg.goto(BASE + '#/store/missing'); pg.wait_for_timeout(700)
    check('an unknown store shows a clear message', 'Store not found' in pg.inner_text('body'))
    check('no script errors (shopper)', not pg.errors, pg.errors[:2]); pg.context.browser.close()

    # ---- 2. A seller applies ------------------------------------------------------------------------------------------
    b = Backend(UID, 'customer'); b.stores = []
    pg, _ = new_page(p, UID, backend=b); pg.goto(BASE + '#/m'); settle(pg)
    check('a seller with no store sees the invitation', 'Open your store on EverNeed' in pg.inner_text('body'))
    tap(pg, '[data-act=mstart]'); pg.wait_for_timeout(500)
    check('start opens step 1 of 5', 'Step 1 of 5' in pg.inner_text('body') and pg.evaluate('location.hash') == '#/m/apply')
    tap(pg, 'button:has-text("Save and continue")'); pg.wait_for_timeout(300)
    check('step 1 refuses an empty store name', 'Step 1 of 5' in pg.inner_text('body') and not any(c[0] == 'POST' and c[1].startswith('stores') for c in b.calls))
    pg.fill('#w-name', 'Urban Finds'); pg.fill('#w-tagline', 'Bags from Lagos'); pg.fill('#w-about', 'Handmade bags.'); pg.wait_for_timeout(600)
    check('the live store link preview calls next_slug', any(c[1] == 'rpc/next_slug' for c in b.calls) and '/store/urban-finds' in pg.inner_text('#mslug'))
    tap(pg, 'button:has-text("Save and continue")'); pg.wait_for_timeout(900)
    post = [c for c in b.calls if c[0] == 'POST' and c[1].startswith('stores')]
    check('step 1 creates a DRAFT store owned by the seller', len(post) == 1 and post[0][3].get('status') == 'draft' and post[0][3].get('owner_id') == UID and post[0][3].get('name') == 'Urban Finds' and 'slug' not in post[0][3] and 'is_official' not in post[0][3], post[0][3] if post else None)
    check('moves on to step 2', 'Step 2 of 5' in pg.inner_text('body'))
    tap(pg, 'button:has-text("Save and continue")'); pg.wait_for_timeout(300)
    check('step 2 needs a category, state, city and phone', 'Step 2 of 5' in pg.inner_text('body'))
    tap(pg, 'label[for=w-cat0]'); pg.fill('#w-state', 'Lagos'); pg.fill('#w-city', 'Ikeja'); pg.fill('#w-phone', '08030000000'); tap(pg, 'button:has-text("Save and continue")'); pg.wait_for_timeout(900)
    check('step 2 saves location and phone (phone goes to the private table)', any(c[0] == 'PATCH' and c[1].startswith('stores') and c[3].get('city') == 'Ikeja' for c in b.calls) and b.priv.get('st1', {}).get('phone') == '08030000000')
    pg.fill('#w-pickup', 'Shop 1, Allen Avenue'); tap(pg, 'label[for=w-direct]'); tap(pg, 'button:has-text("Save and continue")'); pg.wait_for_timeout(300)
    check('direct delivery needs at least one area', 'Step 3 of 5' in pg.inner_text('body'))
    pg.fill('#w-zones', 'Lagos, Ikeja'); tap(pg, 'button:has-text("Save and continue")'); pg.wait_for_timeout(900)
    check('step 3 saves pickup, direct delivery and zones', b.priv['st1'].get('direct_delivery_enabled') is True and b.priv['st1'].get('delivery_zones') == ['Lagos', 'Ikeja'])
    pg.fill('#w-bank', 'GTBank'); pg.fill('#w-acct', '12345'); pg.fill('#w-acname', 'Urban Finds Ltd'); tap(pg, 'button:has-text("Save and continue")'); pg.wait_for_timeout(300)
    check('step 4 rejects a short account number', 'Step 4 of 5' in pg.inner_text('body'))
    pg.fill('#w-acct', '0123456789'); tap(pg, 'button:has-text("Save and continue")'); pg.wait_for_timeout(900)
    check('step 4 saves payout details to the private application', b.apps['st1'].get('account_number') == '0123456789' and b.apps['st1'].get('bank_name') == 'GTBank')
    pg.fill('#w-idref', 'A1234'); tap(pg, 'button:has-text("Send application")'); pg.wait_for_timeout(300)
    check('the agreement must be ticked', not any(c[1] == 'rpc/submit_store' for c in b.calls))
    tap(pg, 'label[for=w-agree]'); tap(pg, 'button:has-text("Send application")'); pg.wait_for_timeout(1200)
    check('sending calls submit_store for this store', any(c[1] == 'rpc/submit_store' and c[3] == {'p_store': 'st1'} for c in b.calls))
    check('afterwards the seller sees "Under review"', 'Under review' in pg.inner_text('body') and pg.evaluate('location.hash') == '#/m')
    check('no request tried to set a store to approved or official', not any(c[3] and isinstance(c[3], dict) and (c[3].get('status') == 'approved' or c[3].get('is_official')) for c in b.calls if c[0] in ('POST', 'PATCH') and c[1].startswith('stores')))
    check('no script errors (applicant)', not pg.errors, pg.errors[:2]); pg.context.browser.close()

    # ---- 3. Admin decides, seller adds a product, admin publishes ------------------------------------------------------------
    b = Backend(ADM, 'admin'); b.profiles[UID] = {'id': UID, 'name': 'Ada Obi', 'email': 'ada@test.local', 'phone': '0801', 'role': 'customer'}
    b.stores = [{'id': 'st1', 'owner_id': UID, 'slug': 'urban-finds', 'name': 'Urban Finds', 'status': 'pending', 'city': 'Ikeja', 'state': 'Lagos', 'categories': ['Fashion'], 'about': 'Handmade bags.', 'is_official': False, 'created_at': '2026-11-01T10:00:00Z'}]
    b.apps['st1'] = {'store_id': 'st1', 'business_name': 'Urban Finds Ltd', 'id_type': 'NIN', 'id_ref': 'A1234', 'bank_name': 'GTBank', 'account_number': '0123456789', 'account_name': 'Urban Finds Ltd', 'submitted_at': '2026-11-01T10:05:00Z'}
    b.priv['st1'] = {'store_id': 'st1', 'phone': '08030000000', 'pickup_address': 'Shop 1', 'direct_delivery_enabled': True, 'delivery_zones': ['Lagos']}
    pg, _ = new_page(p, ADM, 'admin', b); pg.goto(BASE + '#/a/sellers'); settle(pg); t = pg.inner_text('body')
    check('admin sees the pending application with owner, ID and bank details', all(x in t for x in ['Urban Finds', 'Ada Obi', 'A1234', '0123456789', 'GTBank', 'Lagos']), t[:200])
    tap(pg, '[data-act=sapprove]'); pg.wait_for_timeout(400); tap(pg, 'form[data-form=sappr] button'); pg.wait_for_timeout(1000)
    check('approve calls approve_store with the store id', any(c[1] == 'rpc/approve_store' and c[3].get('p_store') == 'st1' for c in b.calls))
    check('the store is approved afterwards', b.stores[0]['status'] == 'approved')
    pg.context.browser.close()
    b2 = b; b2.uid, b2.role = UID, 'customer'; b2.profiles[UID]['role'] = 'customer'
    pg, _ = new_page(p, UID, 'customer', b2); pg.goto(BASE + '#/m'); settle(pg); t = pg.inner_text('body')
    check('the approved seller sees a dashboard', 'Live products' in t and 'Urban Finds' in t, t[:160])
    pg.goto(BASE + '#/m/product/new'); pg.wait_for_timeout(900)
    pg.fill('#w-pname', 'Linen tote'); pg.select_option('#w-pcol', index=0) if pg.locator('#w-pcol option').count() else None
    pg.fill('#w-pprice', '12500'); pg.fill('#w-pstock', '5'); pg.fill('#w-pdesc', 'Soft linen.')
    pg.evaluate("(()=>{const s=document.getElementById('w-pcol');if(s&&!s.value){s.innerHTML='<option>Womens Bags</option>'}})()")
    tap(pg, 'button:has-text("Submit for review")'); pg.wait_for_timeout(1200)
    prod = [c for c in b2.calls if c[0] == 'POST' and c[1].startswith('products')]
    check('a new product is created as a DRAFT in the seller\'s store, never published', len(prod) == 1 and prod[0][3].get('status') == 'draft' and prod[0][3].get('store_id') == 'st1', prod[0][3] if prod else None)
    check('Submit for review then moves it to pending_review', b2.prods and b2.prods[0]['status'] == 'pending_review')
    check('nothing tried to publish from the seller side', not any(c[3] and isinstance(c[3], dict) and c[3].get('status') == 'published' for c in b2.calls if c[0] in ('POST', 'PATCH')))
    pg.context.browser.close()
    b2.uid, b2.role = ADM, 'admin'; b2.profiles[ADM] = {'id': ADM, 'name': 'Admin', 'email': 'admin@test.local', 'role': 'admin'}
    pg, _ = new_page(p, ADM, 'admin', b2); pg.goto(BASE + '#/a/sellers/review'); settle(pg)
    check('admin sees the product waiting for review', 'Linen tote' in pg.inner_text('body') and 'Urban Finds' in pg.inner_text('body'))
    tap(pg, '[data-act=rpub]'); pg.wait_for_timeout(1000)
    check('Publish calls review_product and the product goes live', any(c[1] == 'rpc/review_product' and c[3].get('p_decision') == 'publish' for c in b2.calls) and b2.prods[0]['status'] == 'published')
    check('no script errors (admin)', not pg.errors, pg.errors[:2]); pg.context.browser.close()

print('\n%d of %d checks passed' % (sum(results), len(results))); sys.exit(0 if all(results) else 1)
