"""Read-only Chromium checks. Uses production UI scripts with fictitious grades, no HTTP API."""
import argparse, json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser();parser.add_argument('--screenshot');args=parser.parse_args()

def row(**kwargs):
    r=dict(name='Éloïse Exemple',fiche=1,source='gestion',beforeGrade=56,beforeMax=70,afterGrade='56',afterMax=70)
    r.update(kwargs);return r

def preview(rows, **kwargs):
    activity=dict(titre='Évaluation fictive',periode=1,parametresEvaluation=dict(noteMaximale=70,resultatsDisponibles=False))
    result=dict(activityBefore=activity,activityAfter=json.loads(json.dumps(activity)),rows=rows)
    result.update(kwargs);return result

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1365,'height':1000})
    network=[];page.route('**/*',lambda route:(network.append(route.request.url),route.abort()))
    errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
    css='\n'.join((ROOT/path).read_text() for path in ['resultats/styles.css','resultats/formative.css'] if (ROOT/path).exists())
    if (ROOT/'resultats/mozaik-review.css').exists():css+='\n'+(ROOT/'resultats/mozaik-review.css').read_text()
    page.set_content('<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>'+css+'</style></head><body><button id="launcher">Ouvrir</button></body></html>')
    for path in ['resultats/mozaik-review.js','resultats/assignment-actions.js']:page.add_script_tag(content=(ROOT/path).read_text())
    tests=[]
    def launch(data,context=None):
        page.evaluate('''({data,context})=>{window.fixture=data;window.beforeFixture=JSON.stringify(data);window.answer='pending';window.operation=CardinalAssignmentActions.reviewMozaik(data,context||{groupCode:'101',title:'Travail fictif'}).then(x=>window.answer=x);}''',dict(data=data,context=context))
        page.locator('dialog[open]').wait_for()
    def end(expected):
        page.wait_for_function("window.answer !== 'pending'")
        assert page.evaluate('window.answer')==expected
        assert page.locator('dialog').count()==0
        assert page.evaluate('JSON.stringify(window.fixture)===window.beforeFixture')
    def test(name,fn):
        fn();tests.append(name);print('PASS',name)
    def summary():
        launch(preview([row(),row(fiche=2,name='Alex Exemple',beforeGrade=None,afterGrade=0),row(fiche=3,name='Robin Exemple',afterGrade=35),row(fiche=4,name='Zoé Exemple',afterGrade=80,afterMax=100),row(fiche=5,name='Sam Exemple',source='preserved',beforeGrade='ABS',afterGrade='ABS')]))
        assert page.locator('.mozaik-review-count').count()==4
        assert '1 ajout' in page.locator('.mozaik-review-summary').inner_text()
        page.locator('.mozaik-review-tools select').select_option('changes');assert page.locator('.mozaik-review tbody tr').count()==3
        page.locator('.mozaik-review-tools input').fill('ZOE');assert 'Zoé Exemple' in page.locator('.mozaik-review tbody').inner_text()
        page.locator('.mozaik-review-tools select').select_option('all');page.locator('.mozaik-review-tools input').fill('eloise')
        assert page.locator('.mozaik-review tbody tr').count()==1
        page.get_by_role('button',name='Annuler',exact=True).click();end(False)
    test('Summary, accent-insensitive search and display-only filters',summary)
    def dangerous():
        data=preview([row(afterGrade=0),row(fiche=2,name='Sam Exemple',beforeGrade='EX')])
        data['activityAfter']['parametresEvaluation']['resultatsDisponibles']=True
        launch(data)
        confirm=page.get_by_role('button',name='Confirmer l’envoi',exact=True)
        assert confirm.is_disabled();assert page.locator('[data-ack]').count()==3
        page.locator('.mozaik-review-tools input').fill('personne')
        page.evaluate("document.querySelector('.dialog-actions .btn-primary').onclick()")
        assert page.evaluate('window.answer')=='pending'
        for kind in ['zero','codes']:
            page.locator('[data-ack="'+kind+'"]').check();assert confirm.is_disabled()
        page.locator('[data-ack="publication"]').check();assert confirm.is_enabled()
        confirm.click();end(True)
    test('Zero, special-code and publication safeguards cannot be bypassed by filters',dangerous)
    def escape_reset():
        launch(preview([row(afterGrade=0)]));assert not page.locator('[data-ack="zero"]').is_checked();page.keyboard.press('Escape');end(False)
        launch(preview([row()]));assert page.locator('[data-ack]').count()==0
        assert page.locator('.mozaik-review-tools input').input_value()==''
        page.get_by_role('button',name='Confirmer l’envoi',exact=True).click();end(True)
    test('Escape cancels and subsequent groups never inherit acknowledgements or filters',escape_reset)
    def invalid():
        launch(preview([]));assert page.get_by_role('button',name='Confirmer l’envoi',exact=True).is_disabled()
        assert 'Confirmation bloquée' in page.locator('dialog').inner_text()
        page.get_by_role('button',name='Annuler',exact=True).click();end(False)
    test('Incomplete empty preview fails closed',invalid)
    def stale():
        data=preview([row(gestionBeforeGrade=35,gestionBeforeMax=70)],gestionBefore={'maxScore':70,'weight':39,'reportCardEnabled':True},gestionAfter={'maxScore':70,'weight':45,'reportCardEnabled':True})
        launch(data,{'groupCode':'101','title':'Ancien lot','reconcilingStale':True})
        text=page.locator('dialog').inner_text()
        assert 'identiques dans les deux systèmes' not in text
        assert 'les deux systèmes' not in page.locator('.mozaik-review tbody').inner_text().lower()
        assert 'Gestion actuellement' not in text
        assert 'Gestion sera conservé' in text
        page.get_by_role('button',name='Annuler',exact=True).click();end(False)
    test('Stale recovery never promises overwriting newer Gestion values',stale)
    def safe_text():
        launch(preview([row(name='<img src=x onerror="window.injected=1">')]))
        assert page.locator('.mozaik-review img').count()==0
        assert page.evaluate('window.injected||0')==0
        page.get_by_role('button',name='Annuler',exact=True).click();end(False)
    test('Pupil names are rendered as text, never HTML',safe_text)
    def four_choices():
        for w in ['gestion','mozaik']:
            for m in ['gestion','mozaik']:
                page.evaluate("() => {window.choice='pending';CardinalAssignmentActions.chooseMozaikParameterSources({groupCode:'101',title:'Fictif',gestionWeight:39,gestionMaxScore:70,gestionReportCard:true,mozaikWeight:45,mozaikMaxScore:100,mozaikReportCard:true,isNew:false}).then(x=>window.choice=x);}")
                next=page.get_by_role('button',name='Vérifier l’aperçu',exact=True);assert next.is_disabled()
                page.locator(f'input[name="cardinal-weight-source"][value="{w}"]').check();assert next.is_disabled()
                page.locator(f'input[name="cardinal-maximum-source"][value="{m}"]').check();next.click()
                page.wait_for_function("window.choice!=='pending'")
                assert page.evaluate('window.choice')==dict(weightSource=w,maximumSource=m,alignmentVersion=1)
    test('All four existing parameter-source choices remain unchanged',four_choices)
    def screenshot():
        data=preview([row(afterGrade=80,afterMax=100,gestionBeforeGrade=56,gestionBeforeMax=70),row(fiche=2,name='Alex Exemple',beforeGrade=None,afterGrade=65,afterMax=100,gestionBeforeGrade=45.5,gestionBeforeMax=70),row(fiche=3,name='Robin Exemple',beforeGrade=50,beforeMax=100,afterGrade=42.9,afterMax=100,gestionBeforeGrade=30,gestionBeforeMax=70),row(fiche=4,name='Sam Exemple',source='preserved',beforeGrade='ABS',afterGrade='ABS',afterMax=100)],gestionBefore=dict(maxScore=70,weight=39,reportCardEnabled=True),gestionAfter=dict(maxScore=100,weight=39,reportCardEnabled=True))
        data['activityAfter']['parametresEvaluation']['noteMaximale']=100
        launch(data)
        assert page.get_by_role('button',name='Confirmer l’envoi',exact=True).bounding_box()['y'] < page.viewport_size['height']-40
        assert 'Sans pondération' not in page.locator('dialog tr').filter(has_text='Porté au bulletin').inner_text()
        if args.screenshot:page.screenshot(path=args.screenshot,full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
        page.keyboard.press('Escape');end(False)
    test('Aligned preview works on narrow screen and displays all grade comparisons',screenshot)
    def missing_module():
        page.evaluate('delete window.CardinalMozaikReview')
        error=page.evaluate("CardinalAssignmentActions.reviewMozaik({rows:[]}).then(()=>'',e=>e.message)")
        assert 'Actualise' in error;assert page.locator('dialog').count()==0
    test('Missing cached review module cannot bypass the safeguards',missing_module)
    assert not network,network
    assert not errors,errors
    browser.close()
    print(json.dumps({'passed':len(tests),'network_requests':len(network),'page_errors':len(errors),'tests':tests},ensure_ascii=False))
