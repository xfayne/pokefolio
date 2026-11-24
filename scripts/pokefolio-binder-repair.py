#!/usr/bin/env python3
"""One-time, staging-only Binder repair for the owner-approved 40-page import."""
import argparse
import collections
import datetime
import hashlib
import json
import os
import pathlib
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request

PROJECT = 'pokefolio-staging'
DATABASE = f'projects/{PROJECT}/databases/(default)'
ROOT = f'https://firestore.googleapis.com/v1/{DATABASE}/documents'
DESIRED = ['base1-16', 'gym2-130', 'gym2-15', 'base3-2', 'neo1-9', 'basep-48',
           'base3-12', 'base1-98', 'gym1-1']


def need(condition, message):
    if not condition:
        raise RuntimeError(message)


def mirror(values, gap):
    return [values[i] if i < len(values) else gap(start + offset)
            for start in range(0, len(values), 3) for offset in range(3)
            for i in [start + 2 - offset]]


def normalize(pockets):
    def key(p):
        kind = p['kind']
        field = {'copy': 'copyId', 'wish': 'cardId', 'empty': 'token'}[kind]
        need(set(p) == {'kind', field} and isinstance(p[field], str) and p[field], 'Invalid pocket')
        return kind, p[field]
    keys = [key(p) for p in pockets]
    need(len(set(keys)) == len(keys), 'Duplicate pocket')
    tokens = {v for k, v in keys if k == 'empty'}
    added = []
    def gap(i):
        token = f'import-row-gap:{i}'
        while token in tokens:
            token += ':gap'
        tokens.add(token)
        added.append(('empty', token))
        return {'kind': 'empty', 'token': token}
    result = mirror(pockets, gap)
    need(len(result) <= 1252 and (len(result)+8)//9 == (len(pockets)+8)//9, 'Capacity or page count changed')
    need(collections.Counter(map(key, result)) == collections.Counter(keys+added), 'Pocket identity mismatch')
    return result


def strfield(document, field):
    return document['fields'][field]['stringValue']


def intfield(document, field):
    return int(document['fields'][field]['integerValue'])


def pockets_of(document):
    return json.loads(strfield(document, 'pockets'))


def backup_write(path, data):
    raw = (json.dumps(data, sort_keys=True, indent=2) + '\n').encode()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    need(pathlib.Path(path).read_bytes() == raw, 'Backup readback mismatch')
    print(f'Verified backup: {path}\nSHA256: {hashlib.sha256(raw).hexdigest()}')


class Store:
    def __init__(self):
        self.token = subprocess.check_output(['gcloud', 'auth', 'print-access-token'], text=True).strip()
    def request(self, suffix, data=None, optional=False):
        req = urllib.request.Request(ROOT + suffix, data=None if data is None else json.dumps(data).encode(),
            headers={'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=45) as res:
                return json.load(res)
        except urllib.error.HTTPError as exc:
            if optional and exc.code == 404:
                return None
            raise RuntimeError(f'Firestore HTTP {exc.code}: {exc.read().decode()[:500]}') from None
    def get(self, path, optional=False):
        return self.request('/' + urllib.parse.quote(path, safe='/'), optional=optional)
    def commit(self, changes):
        writes = []
        for document, fields in changes:
            writes.append({'update': {'name': document['name'], 'fields': fields},
                           'updateMask': {'fieldPaths': list(fields)},
                           'currentDocument': {'updateTime': document['updateTime']},
                           'updateTransforms': [{'fieldPath': 'updatedAt', 'setToServerValue': 'REQUEST_TIME'}]})
        self.request(':commit', {'writes': writes})
        for document, fields in changes:
            path = document['name'].split('/documents/', 1)[1]
            current = self.get(path)
            expected = {**document['fields'], **fields}
            actual = dict(current['fields'])
            expected.pop('updatedAt', None)
            actual.pop('updatedAt', None)
            need(actual == expected, f'Post-commit verification failed: {path}; backup retained')
        print(f'Atomic commit and readback verified: {len(changes)} Binder document(s).')


def private_fields(pockets, revision):
    return {'pockets': {'stringValue': json.dumps(pockets, separators=(',', ':'))},
            'revision': {'integerValue': str(revision)}}


def public_fields(tokens):
    return {'pockets': {'stringValue': ';'.join(tokens)}}


def run(args):
    need(re.fullmatch(r'[A-Za-z0-9_-]{1,128}', args.uid), 'Invalid UID')
    db = Store()
    prefix = f'users/{args.uid}/'
    binder = db.get(prefix+'binders/main')
    need(strfield(binder, 'ownerUid') == args.uid and intfield(binder, 'schemaVersion') == 1, 'Wrong binder owner/schema')
    pockets = pockets_of(binder)
    need((len(pockets)+8)//9 == 40, 'Expected the approved 40-page Binder')
    settings = db.get(prefix+'sharing/settings', optional=True)
    share = None
    if settings and settings['fields'].get('enabled', {}).get('booleanValue'):
        share_id = strfield(settings, 'shareId')
        need(re.fullmatch(r'[a-f0-9-]{36}', share_id), 'Invalid existing share ID')
        share = db.get('sharedBinders/'+share_id)
        need(strfield(share, 'ownerUid') == args.uid and intfield(share, 'schemaVersion') == 2, 'Wrong share owner/schema')
    def catalog(p):
        if p['kind'] == 'wish':
            return p['cardId']
        need(p['kind'] == 'copy' and re.fullmatch(r'[A-Za-z0-9_-]+', p['copyId']), 'Unexpected first-page pocket')
        c = db.get(prefix+'copies/'+p['copyId'])['fields']['record']['mapValue']['fields']
        need(c['ownerUid']['stringValue'] == args.uid, 'Wrong copy owner')
        cat = c['catalog']['mapValue']['fields']
        need(cat['kind']['stringValue'] == 'identified', 'Unknown catalog reference')
        return cat['cardId']['stringValue']
    first = list(map(catalog, pockets[:9]))
    if args.rollback:
        archived = json.loads(pathlib.Path(args.rollback).read_text())
        need(archived['project'] == PROJECT and archived['ownerUid'] == args.uid, 'Backup scope mismatch')
        old = archived['binder']
        need(old['name'] == binder['name'] and intfield(binder, 'revision') == intfield(old, 'revision')+1, 'Binder changed since repair')
        need(first == DESIRED and pockets == normalize(pockets_of(old)), 'Binder changed since repair')
        need(settings == archived['settings'], 'Sharing settings changed since repair')
        changes = [(binder, private_fields(pockets_of(old), intfield(binder, 'revision')+1))]
        if archived['share'] is not None:
            old_share = archived['share']
            need(share is not None and share['name'] == old_share['name'], 'Share changed')
            old_tokens = strfield(old_share, 'pockets').split(';')
            need(strfield(share, 'pockets').split(';') == mirror(old_tokens, lambda _: '_'), 'Share changed since repair')
            changes.append((share, public_fields(old_tokens)))
        else:
            need(share is None, 'Share changed since repair')
        db.commit(changes)
        return
    if first == DESIRED:
        print('Already normalized; no writes.'); return
    need(first == mirror(DESIRED, lambda _: None), 'First page does not match the approved mirrored layout')
    need(intfield(binder, 'revision') == 1, 'Binder revision is not the original import; stop for review')
    fixed = normalize(pockets)
    changes = [(binder, private_fields(fixed, 2))]
    if share is not None:
        tokens = strfield(share, 'pockets').split(';')
        need((len(tokens)+8)//9 == 40 and all(t == '_' or re.fullmatch(r'[opw]:[a-zA-Z0-9-]+', t) for t in tokens), 'Unexpected share layout')
        need([t.split(':',1)[-1] for t in tokens[:9]] == first, 'Public snapshot first page differs; stop for review')
        changes.append((share, public_fields(mirror(tokens, lambda _: '_'))))
    print(f'PASS: 40 pages; {len(pockets)} original pockets; {len(fixed)-len(pockets)} materialized implicit gaps; {len(changes)} document(s).')
    if not args.apply:
        print('Dry-run only; no writes.'); return
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    path = pathlib.Path.home()/f'pokefolio-binder-before-repair-{stamp}.json'
    backup_write(path, {'project':PROJECT,'ownerUid':args.uid,'binder':binder,'settings':settings,'share':share})
    need(db.get(prefix+'sharing/settings', optional=True) == settings, 'Sharing settings changed during preparation')
    db.commit(changes)
    print('SUCCESS: staging Binder normalized; existing share ID preserved; no other documents changed.')


def self_test():
    values = [{'kind':'copy','copyId':str(i)} for i in range(359)]
    values[1] = {'kind':'empty','token':'original'}
    result = normalize(values)
    assert len(result) == 360 and result[:3] == values[:3][::-1]
    assert result[-3:] == [{'kind':'empty','token':'import-row-gap:357'}, values[-1], values[-2]]
    assert mirror(DESIRED, lambda _: None) == ['gym2-15','gym2-130','base1-16','basep-48','neo1-9','base3-2','gym1-1','base1-98','base3-12']
    assert normalize([]) == []
    assert mirror(['a','b','c','d'],lambda _: '_') == ['c','b','a','_','_','d']
    print('Self-test passed.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--uid')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--apply', action='store_true')
    mode.add_argument('--rollback', metavar='BACKUP')
    mode.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
    else:
        parser.error('--uid required') if not args.uid else run(args)
