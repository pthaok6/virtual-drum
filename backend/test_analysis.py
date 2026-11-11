import io
import unittest
from unittest.mock import patch

import numpy as np
import soundfile as sf
from fastapi import UploadFile

from app import analyze, retain_strongest_snares


class SnareReductionTests(unittest.TestCase):
    def test_keeps_strongest_half_instead_of_every_second_hit(self):
        notes = [{"time": index * .2, "lane": "snare"} for index in range(6)]
        result = retain_strongest_snares(notes, [1, 9, 8, 2, 3, 7])
        self.assertEqual(result, [notes[1], notes[2], notes[5]])
        self.assertEqual(len(notes), 6)

    def test_preserves_other_instruments_and_original_times(self):
        notes = [
            {"time": .123, "lane": "snare"},
            {"time": .123, "lane": "kick"},
            {"time": .456, "lane": "hihat"},
            {"time": .789, "lane": "snare"},
            {"time": .8, "lane": "tom"},
            {"time": .9, "lane": "crash"},
        ]
        result = retain_strongest_snares(notes, [1, 0, 0, 10, 0, 0])
        self.assertEqual(result, notes[1:])
        self.assertTrue(all(note is original for note, original in zip(result, notes[1:])))

    def test_odd_counts_round_up_and_single_snare_is_preserved(self):
        for count in [1, 3, 5, 143]:
            notes = [{"time": index, "lane": "snare"} for index in range(count)]
            result = retain_strongest_snares(notes, list(range(count)))
            self.assertEqual(len(result), (count + 1) // 2)
            self.assertEqual(result[-1], notes[-1])

    def test_empty_or_no_snare_chart_is_unchanged(self):
        self.assertEqual(retain_strongest_snares([], []), [])
        notes = [{"time": 0, "lane": "kick"}, {"time": 1, "lane": "hihat"}]
        self.assertEqual(retain_strongest_snares(notes, [1, 2]), notes)

    def test_equal_strengths_choose_earlier_hits_deterministically(self):
        notes = [{"time": index, "lane": "snare"} for index in range(4)]
        self.assertEqual(retain_strongest_snares(notes, [2, 2, 2, 2]), notes[:2])

    def test_rejects_misaligned_strengths(self):
        with self.assertRaises(ValueError):
            retain_strongest_snares([{"time": 0, "lane": "snare"}], [])

    def test_silent_audio_returns_empty_chart_without_backtracking_error(self):
        buffer = io.BytesIO()
        sf.write(buffer, np.zeros(44100 * 3), 44100, format="WAV")
        buffer.seek(0)
        with patch.dict("os.environ", {"USE_DEMUCS": "false"}):
            result = analyze(UploadFile(file=buffer, filename="silence.wav"))
        self.assertEqual(result["notes"], [])
        self.assertEqual(result["snareReduction"], {"originalCount": 0, "keptCount": 0})


if __name__ == "__main__":
    unittest.main()
