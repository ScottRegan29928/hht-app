"""Website Visits v1.0.0: preserve the current app artifacts/routes; add one exact-public-host shell.

Run after building public/website-visits-heritage-v1.js from scripts/heritage-visits.ts.
This release helper requires a frozen raw artifact manifest and exact prior Vercel request.
It never changes backend, original shells, images, portal/preview routing, or other host rules.
"""
import argparse,hashlib,json,pathlib,re

def prepare(dist: pathlib.Path, baseline_request: dict, expected_hashes: dict) -> dict:
    for path,sha in expected_hashes.items():
        assert hashlib.sha1((dist/path).read_bytes()).hexdigest()==sha, "Prior artifact changed: "+path
    original=(dist/'index-heritage.html').read_text()
    assert 'website-visits-heritage' not in original
    marker='<script defer src="/website-visits-heritage-v1.js" data-website-visits-release="1.0.0"></script>'
    (dist/'index-heritage-visits.html').write_text(original.replace('</body>',marker+'\n  </body>',1))
    paths=['/','/accessibility']+['/community/'+s for s in ['swallowtail-at-sea-pines','spicebush','racquet-club','plantation-club','night-heron','port-villa','twin-oaks','ketch-court']]
    regex='^(?:'+'|'.join(re.escape(p).replace('/','/')+('/?' if p!='/' else '') for p in paths)+')$'
    rule={'src':regex,'dest':'/index-heritage-visits.html','has':[{'type':'host','value':'heritagevacations.com'}]}
    routes=list(baseline_request['routes'])
    insertion=next(i for i,r in enumerate(routes) if r.get('dest')=='/index-heritage.html' and r.get('src')=='^/(index\\.html)?$')
    routes.insert(insertion,rule)
    assert routes[:insertion]+routes[insertion+1:]==baseline_request['routes']
    return {'routes':routes,'addedRoute':rule,'insertionIndex':insertion}

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--dist',required=True)
    parser.add_argument('--baseline-request',required=True)
    parser.add_argument('--expected-hashes',required=True)
    parser.add_argument('--output',required=True)
    a=parser.parse_args()
    result=prepare(pathlib.Path(a.dist),json.loads(pathlib.Path(a.baseline_request).read_text()),json.loads(pathlib.Path(a.expected_hashes).read_text()))
    pathlib.Path(a.output).write_text(json.dumps(result,indent=2))
