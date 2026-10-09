"""
Unit tests for AgriSense Crop Decay Model.
Verifies mathematical invariants, monotonicity, storage mitigation ranking,
and JSON serialization.
"""

import json
import os
import sys
import unittest

# Ensure ml_service is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.decay_model import DecayModel


class TestDecayModel(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = DecayModel()

    def test_supported_crops(self):
        crops = self.model.get_supported_crops()
        self.assertIn("tomato", crops)
        self.assertIn("onion", crops)

    def test_case_insensitive_crop_and_storage(self):
        res1 = self.model.simulate(crop="Tomato", storage_type="AMBIENT", horizon_days=3)
        res2 = self.model.simulate(crop="tomato", storage_type="ambient", horizon_days=3)
        self.assertEqual(res1.crop, res2.crop)
        self.assertAlmostEqual(
            res1.summary["final_sellable_weight_quintals"],
            res2.summary["final_sellable_weight_quintals"],
            places=4,
        )

    def test_monotonic_weight_loss(self):
        """Retained weight must strictly decrease over time."""
        res = self.model.simulate(crop="tomato", storage_type="ambient", horizon_days=7)
        weights = [s.retained_weight_quintals for s in res.daily_schedule]
        for i in range(len(weights) - 1):
            self.assertGreater(weights[i], weights[i + 1])

    def test_storage_mitigation_hierarchy_tomato(self):
        """Physical loss hierarchy: Cold Storage < ZECC < Ambient."""
        weather = [
            {"temp_mean": 28.0, "humidity_mean": 70.0, "precipitation_sum": 0.0}
            for _ in range(7)
        ]
        cold = self.model.simulate(
            crop="tomato", storage_type="cold_storage", horizon_days=7, weather_forecast=weather
        )
        zecc = self.model.simulate(
            crop="tomato", storage_type="zecc", horizon_days=7, weather_forecast=weather
        )
        ambient = self.model.simulate(
            crop="tomato", storage_type="ambient", horizon_days=7, weather_forecast=weather
        )

        loss_cold = cold.summary["total_physical_loss_pct"]
        loss_zecc = zecc.summary["total_physical_loss_pct"]
        loss_ambient = ambient.summary["total_physical_loss_pct"]

        self.assertLess(loss_cold, loss_zecc)
        self.assertLess(loss_zecc, loss_ambient)

    def test_storage_mitigation_hierarchy_onion(self):
        """Physical loss hierarchy: Cold Storage < Ventilated Chawl < Ambient."""
        weather = [
            {"temp_mean": 30.0, "humidity_mean": 80.0, "precipitation_sum": 10.0}
            for _ in range(14)
        ]
        cold = self.model.simulate(
            crop="onion", storage_type="cold_storage", horizon_days=14, weather_forecast=weather
        )
        chawl = self.model.simulate(
            crop="onion", storage_type="ventilated_chawl", horizon_days=14, weather_forecast=weather
        )
        ambient = self.model.simulate(
            crop="onion", storage_type="ambient", horizon_days=14, weather_forecast=weather
        )

        loss_cold = cold.summary["total_physical_loss_pct"]
        loss_chawl = chawl.summary["total_physical_loss_pct"]
        loss_ambient = ambient.summary["total_physical_loss_pct"]

        self.assertLess(loss_cold, loss_chawl)
        self.assertLess(loss_chawl, loss_ambient)

    def test_temperature_stress_acceleration(self):
        """Higher temperatures must accelerate decay rate."""
        cool_weather = [
            {"temp_mean": 18.0, "humidity_mean": 75.0, "precipitation_sum": 0.0}
            for _ in range(5)
        ]
        hot_weather = [
            {"temp_mean": 34.0, "humidity_mean": 75.0, "precipitation_sum": 0.0}
            for _ in range(5)
        ]
        res_cool = self.model.simulate(
            crop="tomato", storage_type="ambient", horizon_days=5, weather_forecast=cool_weather
        )
        res_hot = self.model.simulate(
            crop="tomato", storage_type="ambient", horizon_days=5, weather_forecast=hot_weather
        )

        self.assertGreater(
            res_hot.summary["total_physical_loss_pct"],
            res_cool.summary["total_physical_loss_pct"],
        )

    def test_safe_holding_limit_detection(self):
        """Hot ambient tomatoes must reach safe holding cutoff before day 7."""
        hot_weather = [
            {"temp_mean": 32.0, "humidity_mean": 70.0, "precipitation_sum": 0.0}
            for _ in range(7)
        ]
        res = self.model.simulate(
            crop="tomato", storage_type="ambient", horizon_days=7, weather_forecast=hot_weather
        )
        self.assertLessEqual(res.safe_holding_days, 4)
        self.assertEqual(res.summary["final_risk_level"], "CRITICAL")

    def test_json_serializability(self):
        """Output must cleanly convert to JSON for FastAPI / Express responses."""
        res = self.model.simulate(crop="tomato", horizon_days=5)
        d = res.to_dict()
        json_str = json.dumps(d)
        self.assertIsInstance(json_str, str)
        self.assertIn("daily_schedule", d)
        self.assertEqual(len(d["daily_schedule"]), 5)


if __name__ == "__main__":
    unittest.main(verbosity=2)
