import copy
import unittest

from fifacm_formations import (
    infer_formation, normalize_formation_catalogue,
    formation_catalogue_ids, validate_club_formation_references,
)


def lineup(positions):
    return [{'playerId': i + 1, 'position': p} for i, p in enumerate(positions.split())]


class FormationTests(unittest.TestCase):
    def test_catalogue_groups_variants_without_losing_source_definitions(self):
        variants = [
            {'code': '442', 'label': 'Flat', 'positions': 'LS RS LM LCM RCM RM LB LCB RCB RB GK'.split()},
            {'code': '442-2', 'label': 'Holding', 'positions': 'LS RS LM LCM RCM RM LB LCB RCB RB GK'.split()},
        ]
        catalogue = normalize_formation_catalogue(variants)
        self.assertEqual(len(catalogue), 1)
        self.assertEqual(catalogue[0]['id'], '4-4-2')
        self.assertEqual(catalogue[0]['lines'], [4, 4, 2])
        self.assertEqual(catalogue[0]['variants'], variants)

    def test_club_references_must_exist_in_catalogue(self):
        catalogue = [{'id': '4-4-2', 'label': '4-4-2', 'lines': [4, 4, 2]}]
        validate_club_formation_references([{'id': 1, 'formation': '4-4-2'}, {'id': 2, 'formation': None}], catalogue)
        with self.assertRaisesRegex(ValueError, 'absent'):
            validate_club_formation_references([{'id': 1, 'formation': '4-3-3'}], catalogue)

    def test_catalogue_rejects_duplicate_ids_and_invalid_lines(self):
        entry = {'id': '4-4-2', 'label': '4-4-2', 'lines': [4, 4, 2]}
        with self.assertRaises(ValueError):
            formation_catalogue_ids([entry, entry])
        with self.assertRaises(ValueError):
            formation_catalogue_ids([dict(entry, lines=[4, 4, 3])])

    def test_basic_shapes_from_pitch_positions(self):
        cases = [
            ('ST CAM LM RM LDM RDM LB LCB RCB RB GK', '4-2-3-1'),
            ('LW ST RW CAM LDM RDM LB LCB RCB RB GK', '4-3-3'),
            ('ST LAM RAM LM LCM RCM RM LCB CB RCB GK', '3-4-2-1'),
            ('LS RS LCM RCM CDM LB LCB CB RCB RB GK', '5-3-2'),
            ('LS RS LM LCM RCM RM LB LCB RCB RB GK', '4-4-2'),
            ('LS RS LM LDM RDM RM LB LCB RCB RB GK', '4-4-2'),
            ('LS RS LM CDM CM RM LB LCB RCB RB GK', '4-1-3-2'),
            ('LS RS CAM LM CDM RM LB LCB RCB RB GK', '4-1-2-1-2'),
            ('LS RS CAM LCM CDM RCM LB LCB RCB RB GK', '4-1-2-1-2'),
        ]
        for positions, expected in cases:
            with self.subTest(positions=positions):
                self.assertEqual(infer_formation(lineup(positions)), expected)

    def test_wing_backs_count_in_defensive_line(self):
        self.assertEqual(infer_formation(lineup('LW ST RW LCM RCM LWB LCB CB RCB RWB GK')), '5-2-3')

    def test_order_does_not_change_shape_or_mutate_input(self):
        players = lineup('ST CAM LM RM LDM RDM LB LCB RCB RB GK')
        original = copy.deepcopy(players)
        self.assertEqual(infer_formation(list(reversed(players))), '4-2-3-1')
        self.assertEqual(players, original)

    def test_incomplete_or_duplicate_players_are_not_inferred(self):
        players = lineup('ST CAM LM RM LDM RDM LB LCB RCB RB GK')
        self.assertIsNone(infer_formation(players[:-1]))
        players[0]['playerId'] = players[1]['playerId']
        self.assertIsNone(infer_formation(players))

    def test_unknown_positions_and_invalid_goalkeeper_count(self):
        for positions in [
            'ST CAM LM RM LDM RDM LB LCB RCB RB UNKNOWN',
            'ST CAM LM RM LDM RDM LB LCB RCB RB ST',
            'ST CAM LM RM LDM RDM LB LCB RCB GK GK',
        ]:
            with self.subTest(positions=positions):
                self.assertIsNone(infer_formation(lineup(positions)))

    def test_unrecognized_complete_shape_remains_unknown(self):
        self.assertIsNone(infer_formation(lineup('ST LS RS LW RW CAM LM RM CDM CB GK')))


if __name__ == '__main__':
    unittest.main()
