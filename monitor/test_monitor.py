import os
import unittest
from unittest.mock import patch, MagicMock
import tempfile
import time

from configuration import parse_simple_yaml, Configuration, load_config
from collectors import CPUCollector, MemoryCollector, LogFileCollector, WebAccessLogCollector
from alerts import AlertManager, AlertState

class TestMonitor(unittest.TestCase):
    def test_parse_simple_yaml(self):
        yaml_content = """
DEFAULT_LOG_FILE: "app.log"
POLL_INTERVAL_SECONDS: 2
THRESHOLDS:
  CPU:
    WARNING: 70.0
    CRITICAL: 90.0
"""
        parsed = parse_simple_yaml(yaml_content)
        self.assertEqual(parsed["DEFAULT_LOG_FILE"], "app.log")
        self.assertEqual(parsed["POLL_INTERVAL_SECONDS"], 2)
        self.assertEqual(parsed["THRESHOLDS"]["CPU"]["WARNING"], 70.0)

    def test_configuration_read_only(self):
        config_dict = {
            "default_log_file": "app.log",
            "thresholds": {
                "cpu": {
                    "warning": 70.0
                }
            }
        }
        config = Configuration(config_dict)
        # Check uppercase mapping
        self.assertEqual(config.DEFAULT_LOG_FILE, "app.log")
        self.assertEqual(config.THRESHOLDS.CPU.WARNING, 70.0)
        
        # Check read-only constraint
        with self.assertRaises(TypeError):
            config.DEFAULT_LOG_FILE = "new.log"
            
        with self.assertRaises(TypeError):
            config.THRESHOLDS.CPU.WARNING = 80.0

    @patch('psutil.cpu_percent')
    @patch('psutil.virtual_memory')
    def test_system_collectors(self, mock_virtual_memory, mock_cpu_percent):
        mock_cpu_percent.return_value = 45.0
        mock_virtual_memory.return_value.percent = 60.0
        
        self.assertEqual(CPUCollector.collect(), 45.0)
        self.assertEqual(MemoryCollector.collect(), 60.0)

    def test_log_file_collector(self):
        with tempfile.NamedTemporaryFile(mode='w+', delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            collector = LogFileCollector(tmp_path, window_seconds=10)
            collector.start()
            
            # Write error log
            with open(tmp_path, 'a') as f:
                f.write("INFO: healthy line\n")
                f.write("ERROR: database connection error\n")
                f.write("EXCEPTION: null pointer exception\n")
                
            time.sleep(0.5) # allow tail thread to process
            self.assertEqual(collector.get_error_count(), 2)
            
            collector.stop()
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def test_web_access_log_collector(self):
        with tempfile.NamedTemporaryFile(mode='w+', delete=False) as tmp:
            tmp_path = tmp.name
            
        try:
            collector = WebAccessLogCollector(tmp_path, window_seconds=10)
            collector.start()
            
            with open(tmp_path, 'a') as f:
                f.write("[2026-06-27 10:00:00] GET / - 200 - 150ms\n")
                f.write("[2026-06-27 10:00:01] POST /save - 200 - 350ms\n")
                
            time.sleep(0.5)
            self.assertEqual(collector.get_average_latency(), 250.0)
            
            collector.stop()
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def test_alert_manager(self):
        thresholds = {
            "CPU": {"WARNING": 70.0, "CRITICAL": 90.0}
        }
        with tempfile.NamedTemporaryFile(mode='w+', delete=False) as tmp:
            alert_log_path = tmp.name

        try:
            manager = AlertManager(alert_log_path, thresholds)
            
            # Evaluate within normal range -> State should stay OK
            manager.evaluate_metric("CPU", 50.0)
            self.assertEqual(manager.states["CPU"], AlertState.OK)
            
            # Evaluate warning range -> State transitions to WARNING
            manager.evaluate_metric("CPU", 75.0)
            self.assertEqual(manager.states["CPU"], AlertState.WARNING)
            
            # Evaluate critical range -> State transitions to CRITICAL
            manager.evaluate_metric("CPU", 95.0)
            self.assertEqual(manager.states["CPU"], AlertState.CRITICAL)
            
            # Evaluate back to normal -> State transitions to OK
            manager.evaluate_metric("CPU", 40.0)
            self.assertEqual(manager.states["CPU"], AlertState.OK)
            
            # Read alert log file and verify transition logs
            with open(alert_log_path, 'r') as f:
                lines = f.readlines()
            self.assertEqual(len(lines), 3)
            self.assertIn("OK -> WARNING", lines[0])
            self.assertIn("WARNING -> CRITICAL", lines[1])
            self.assertIn("CRITICAL -> OK", lines[2])
            
        finally:
            if os.path.exists(alert_log_path):
                os.remove(alert_log_path)

if __name__ == '__main__':
    unittest.main()
