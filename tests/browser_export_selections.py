"""Disposable-browser export gate. --release previews a reviewed public bundle; --live tests Pages."""
import argparse, json, time
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

URL = 'https://harrison-f.github.io/harrison-clothes-contenders/'
TOPIC = 'harrison-clothes-contenders'
p = argparse.ArgumentParser()
p.add_argument('--release', type=Path)
p.add_argument('--live', action='store_true')
p.add_argument('--output', type=Path, default=Path.home()/'.hermes/cache/scratch/contenders-export-qa')
a = p.parse_args()
assert a.live or a.release
out = a.output
out.mkdir(parents=True, exist_ok=True)
start = time.monotonic()
errors = []
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    def context(**kwargs):
        c = browser.new_context(accept_downloads=True, **kwargs)
        if not a.live:
            def route(r):
                rel = urlsplit(r.request.url).path.removeprefix('/harrison-clothes-contenders/') or 'index.html'
                file = a.release/rel
                if file.is_file():
                    r.fulfill(path=str(file))
                else:
                    r.abort()
            c.route(URL+'**', route)
        return c
    def open_page(c):
        page = c.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        response = page.goto(URL)
        assert response.status == 200
        page.get_by_role('button', name='Export selections', exact=True).wait_for()
        assert page.url == URL
        return page
    def export(page, label, keyboard=False):
        button = page.get_by_role('button', name='Export selections', exact=True)
        button.hover()
        button.focus()
        before = page.evaluate('JSON.stringify(localStorage)')
        with page.expect_download() as result:
            button.press('Enter') if keyboard else button.click()
        download = result.value
        assert download.suggested_filename == TOPIC+'-selections.json'
        dest = out/(label+'.json')
        download.save_as(dest)
        data = json.loads(dest.read_text())
        assert page.evaluate('JSON.stringify(localStorage)') == before
        assert data['schemaVersion'] == 1 and data['topicId'] == TOPIC
        assert len(data['fullOrderProductIds']) == 40
        assert len(set(data['fullOrderProductIds'])) == 40
        assert 'PRIVATE_SENTINEL' not in dest.read_text()
        assert set(data) == {'schemaVersion','topicId','fullOrderProductIds','hasManualOrder','orderScope','effectiveRemovedProductIds','defaultHiddenProductIds','explicitlyRestoredDefaultProductIds','view','storageAvailable'}
        assert button.bounding_box()['height'] >= 44
        return data
    c = context(viewport={'width':1440,'height':1000})
    page = open_page(c)
    fresh = export(page, 'fresh', keyboard=True)
    assert fresh['hasManualOrder'] is False
    assert fresh['effectiveRemovedProductIds'] == ['contender-32']
    assert fresh['explicitlyRestoredDefaultProductIds'] == []
    assert page.evaluate('localStorage.length') == 0
    page.screenshot(path=str(out/'desktop.png'))
    custom = list(reversed(fresh['fullOrderProductIds']))
    seed = {f'research-catalog-order:v1:{TOPIC}':json.dumps(custom),f'research-catalog-hidden:v1:{TOPIC}':json.dumps(['contender-25','obsolete-id']),f'research-catalog-restored:v1:{TOPIC}':json.dumps(['contender-32']), 'unrelated-private-key':'PRIVATE_SENTINEL'}
    page.evaluate('(seed)=>{for(const [k,v] of Object.entries(seed))localStorage.setItem(k,v)}', seed)
    before = page.evaluate('JSON.stringify(localStorage)')
    page.reload()
    page.get_by_role('button', name='Export selections', exact=True).wait_for()
    assert page.evaluate('JSON.stringify(localStorage)') == before
    data = export(page, 'seeded')
    assert data['hasManualOrder'] is True and data['fullOrderProductIds'] == custom
    assert data['effectiveRemovedProductIds'] == ['contender-25']
    assert data['explicitlyRestoredDefaultProductIds'] == ['contender-32']
    page.locator('[data-sort="price"]').click()
    category = page.locator('[data-category-filter]').nth(1)
    category_name = category.get_attribute('data-category-filter')
    category.click()
    page.locator('input[type=search]').fill('cotton')
    filtered = export(page, 'filtered')
    assert filtered['fullOrderProductIds'] == custom
    assert filtered['view']['search'] == 'cotton'
    assert filtered['view']['category'] == category_name
    assert filtered['view']['sort'] == 'price'
    assert len(filtered['view']['visibleProductIds']) < 40
    page.locator('input[type=search]').fill('')
    page.locator('[data-category-filter="All"]').click()
    page.locator('[data-sort="manual"]').click()
    page.locator('[data-product-id="contender-32"] .remove-item').click()
    removed = export(page, 'removed-again')
    assert set(removed['effectiveRemovedProductIds']) == {'contender-25','contender-32'}
    assert removed['explicitlyRestoredDefaultProductIds'] == []
    page.get_by_role('button',name='Undo',exact=True).click()
    assert export(page,'undo')['effectiveRemovedProductIds'] == ['contender-25']
    page.get_by_role('button',name='Removed (1)',exact=True).click()
    assert export(page,'removed-view')['view']['visibleProductIds'] == ['contender-25']
    page.reload()
    page.get_by_role('button', name='Export selections', exact=True).wait_for()
    assert export(page,'reload')['fullOrderProductIds'] == custom
    assert page.evaluate('JSON.stringify(localStorage)') != before  # intentional remove/undo writes only
    c.close()
    c = context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    page = open_page(c)
    export(page,'mobile')
    for width in [320,360,390,430,850]:
        page.set_viewport_size({'width':width,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert page.get_by_role('button',name='Export selections',exact=True).bounding_box()['height'] >= 44
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(out/'mobile.png'))
    c.close()
    c = context()
    c.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('QA storage denied')}})")
    page = open_page(c)
    button = page.get_by_role('button',name='Export selections',exact=True)
    with page.expect_download() as result:
        button.click()
    result.value.save_as(out/'storage-denied.json')
    denied = json.loads((out/'storage-denied.json').read_text())
    assert denied['storageAvailable'] is False
    assert denied['effectiveRemovedProductIds'] == ['contender-32']
    c.close()
    browser.close()
assert not errors, errors
print(json.dumps({'passed':True,'live':a.live,'seconds':round(time.monotonic()-start,2),'errors':errors,'output':str(out),'checks':['real JSON download','fresh defaults','full manual order','hidden and explicit restore','filters and alternate sort','remove/undo','removed view','reload/storage preservation','unrelated storage excluded','keyboard activation','mobile 320/360/390/430/850','storage denied']}))
