"""Infer basic football shapes from a complete starting XI, without builder codes."""

from collections import Counter
import json


def normalize_formation_catalogue(variants):
    """Group source builder variants under stable IDs for their basic shape."""
    formations = {}
    for variant in variants:
        shape = '-'.join(variant['code'].split('-')[0])
        entry = formations.setdefault(shape, {
            'id': shape, 'label': shape, 'lines': list(map(int, shape.split('-'))), 'variants': [],
        })
        entry['variants'].append(variant)
    result = [formations[key] for key in sorted(formations)]
    formation_catalogue_ids(result)
    return result


def formation_catalogue_ids(formations):
    """Validate catalogue identities and return the allowed club references."""
    ids = set()
    codes = set()
    if not isinstance(formations, list) or not formations:
        raise ValueError('Formation catalogue must be a nonempty JSON array')
    for entry in formations:
        shape = entry.get('id')
        lines = entry.get('lines')
        if not isinstance(lines, list) or not lines or any(type(n) is not int or n <= 0 for n in lines):
            raise ValueError(f'Invalid formation lines: {shape}')
        if sum(lines) != 10 or shape != '-'.join(map(str, lines)) or shape in ids:
            raise ValueError(f'Invalid or duplicate formation ID: {shape}')
        if not isinstance(entry.get('label'), str) or not entry['label']:
            raise ValueError(f'Missing formation label: {shape}')
        ids.add(shape)
        for variant in entry.get('variants', []):
            code = variant['code']
            if code in codes or '-'.join(code.split('-')[0]) != shape:
                raise ValueError(f'Invalid or duplicate variant: {code}')
            if len(variant['positions']) != 11 or variant['positions'].count('GK') != 1:
                raise ValueError(f'Invalid variant positions: {code}')
            codes.add(code)
    return ids


def load_formation_catalogue(path):
    formations = json.loads(path.read_text())
    formation_catalogue_ids(formations)
    return formations


def validate_club_formation_references(clubs, formations):
    ids = formation_catalogue_ids(formations)
    missing = [c['id'] for c in clubs if c.get('formation') is not None and c['formation'] not in ids]
    if missing:
        raise ValueError(f'Club formation IDs absent from formations.json: {missing}')


POSITION_ROLES = {
    'GK': 'GK',
    'LB': 'FB', 'RB': 'FB', 'LWB': 'FB', 'RWB': 'FB',
    'LCB': 'CB', 'CB': 'CB', 'RCB': 'CB',
    'LDM': 'DM', 'CDM': 'DM', 'RDM': 'DM',
    'LCM': 'CM', 'CM': 'CM', 'RCM': 'CM',
    'LM': 'WM', 'RM': 'WM',
    'LAM': 'AM', 'CAM': 'AM', 'RAM': 'AM', 'LF': 'AM', 'RF': 'AM',
    'LW': 'WG', 'RW': 'WG',
    'LS': 'ST', 'ST': 'ST', 'RS': 'ST', 'CF': 'ST',
}

# Ten outfield roles, grouped into conventional basic shapes. Left/right and
# tactical variants are deliberately collapsed; the original XI keeps them.
SHAPE_ROLES = {
    '4-2-3-1': ['FB FB CB CB DM DM WM WM AM ST', 'FB FB CB CB DM DM AM AM AM ST'],
    '4-1-4-1': ['FB FB CB CB DM CM CM WM WM ST'],
    '4-3-3': [
        'FB FB CB CB DM CM CM WG WG ST', 'FB FB CB CB CM CM CM WG WG ST',
        'FB FB CB CB AM CM CM WG WG ST', 'FB FB CB CB DM DM CM WG WG ST',
        'FB FB CB CB DM DM AM WG WG ST',
    ],
    '3-4-2-1': ['CB CB CB CM CM WM WM AM AM ST'],
    '4-4-2': ['FB FB CB CB CM CM WM WM ST ST', 'FB FB CB CB DM DM WM WM ST ST'],
    '5-3-2': ['FB FB CB CB CB DM CM CM ST ST', 'FB FB CB CB CB CM CM CM ST ST',
              'FB FB CB CB CB DM DM CM ST ST'],
    '3-4-3': ['CB CB CB CM CM WM WM WG WG ST', 'CB CB CB DM AM WM WM WG WG ST'],
    '3-4-1-2': ['CB CB CB CM CM WM WM AM ST ST'],
    '3-1-4-2': ['CB CB CB DM CM CM WM WM ST ST'],
    '4-4-1-1': ['FB FB CB CB CM CM WM WM AM ST'],
    '5-4-1': ['FB FB CB CB CB CM CM WM WM ST', 'FB FB CB CB CB DM AM WM WM ST'],
    '4-3-1-2': ['FB FB CB CB CM CM CM AM ST ST'],
    '4-1-2-1-2': ['FB FB CB CB DM CM CM AM ST ST', 'FB FB CB CB DM WM WM AM ST ST'],
    '3-5-2': ['CB CB CB DM DM WM WM AM ST ST', 'CB CB CB CM CM CM WM WM ST ST'],
    '4-2-2-2': ['FB FB CB CB DM DM AM AM ST ST'],
    '5-2-3': ['FB FB CB CB CB CM CM WG WG ST', 'FB FB CB CB CB DM DM WG WG ST'],
    '4-3-2-1': ['FB FB CB CB CM CM CM AM AM ST'],
    '4-1-3-2': ['FB FB CB CB DM CM WM WM ST ST'],
    '4-2-4': ['FB FB CB CB CM CM WG WG ST ST'],
    '4-5-1': ['FB FB CB CB CM CM CM WM WM ST', 'FB FB CB CB CM WM WM AM AM ST'],
}

ROLE_SHAPES = {}
for shape, patterns in SHAPE_ROLES.items():
    for pattern in patterns:
        roles = pattern.split()
        assert len(roles) == 10 and sum(map(int, shape.split('-'))) == 10
        key = tuple(sorted(roles))
        assert key not in ROLE_SHAPES, f'Ambiguous shape pattern: {pattern}'
        ROLE_SHAPES[key] = shape


def infer_formation(starting_xi):
    """Return a conventional basic shape, or None for incomplete/unknown lineups."""
    if len(starting_xi) != 11:
        return None
    ids = [player.get('playerId') for player in starting_xi]
    if any(type(pid) is not int or pid <= 0 for pid in ids) or len(set(ids)) != 11:
        return None
    roles = [POSITION_ROLES.get(player.get('position')) for player in starting_xi]
    if None in roles or Counter(roles)['GK'] != 1:
        return None
    return ROLE_SHAPES.get(tuple(sorted(role for role in roles if role != 'GK')))
