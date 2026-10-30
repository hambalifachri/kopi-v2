"""Publish aggregate menu quantities only; customer/order details never leave memory."""
import argparse
from collections import Counter,defaultdict
from datetime import datetime,timedelta,timezone
import json
from pathlib import Path
import sys

def aggregate(rows):
    counts=defaultdict(Counter)
    brands={'Kopi Kenangan':'kopi-kenangan','Tomoro':'tomoro','Fore':'fore'}
    for row in rows:
        brand=brands.get(row.get('brand'))
        if not brand:continue
        items=row.get('items') or []
        if isinstance(items,str):
            try:items=json.loads(items)
            except ValueError:continue
        if not isinstance(items,list):continue
        for item in items:
            if not isinstance(item,dict):continue
            name=' '.join(str(item.get('name') or '').split())
            qty=item.get('qty',item.get('quantity',0))
            if isinstance(qty,bool):continue
            try:qty=float(qty)
            except (ValueError,TypeError):continue
            if not name or not qty.is_integer() or not 0<qty<=1000:continue
            counts[brand][name.casefold()]+=int(qty)
    return {brand:dict(counter.most_common()) for brand,counter in counts.items()}

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--runner-directory',required=True)
    args=parser.parse_args()
    sys.path.insert(0,args.runner_directory)
    from inventory_remote_orders import remote
    now=datetime.now(timezone.utc)
    since=now-timedelta(days=30)
    rows=[]
    for offset in range(0,100000,500):
        page=remote({'select':'brand,items','status':'eq.completed','created_at':'gte.'+since.isoformat(),
                     'order':'id.asc','limit':'500','offset':str(offset)})
        rows.extend(page)
        if len(page)<500:break
    else:raise RuntimeError('Too many orders; snapshot was not replaced.')
    payload={'updatedAt':now.isoformat(),'since':since.isoformat(),'days':30,
             'basis':'completed-item-quantity','brands':aggregate(rows)}
    output=Path(__file__).resolve().parents[1]/'assets'/'data'/'best-sellers.json'
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f'Aggregated {len(rows)} completed orders; only menu names and quantities published.')
    for brand,counts in payload['brands'].items():print(brand,list(counts.items())[:8])
