import os
import time
from typing import Dict, Any

class AlertState:
    OK = "OK"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"

class AlertManager:
    def __init__(self, alert_log_path: str, thresholds: Dict[str, Any]):
        self.alert_log_path = os.path.abspath(alert_log_path)
        self.thresholds = thresholds
        self.states: Dict[str, str] = {
            "CPU": AlertState.OK,
            "MEMORY": AlertState.OK,
            "LOG_ERRORS": AlertState.OK,
            "WEB_LATENCY": AlertState.OK
        }
        
        # Ensure file and directory exist
        directory = os.path.dirname(self.alert_log_path)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
        if not os.path.exists(self.alert_log_path):
            with open(self.alert_log_path, "w", encoding="utf-8") as f:
                pass

    def evaluate_metric(self, name: str, value: float) -> None:
        # Resolve config mapping (e.g. CPU, MEMORY, LOG_ERRORS, WEB_LATENCY)
        metric_thresholds = self.thresholds.get(name)
        if not metric_thresholds:
            return

        warning_threshold = metric_thresholds.get("WARNING")
        critical_threshold = metric_thresholds.get("CRITICAL")

        new_state = AlertState.OK
        if value >= critical_threshold:
            new_state = AlertState.CRITICAL
        elif value >= warning_threshold:
            new_state = AlertState.WARNING

        old_state = self.states.get(name, AlertState.OK)
        if new_state != old_state:
            self.states[name] = new_state
            self.trigger_alert(name, old_state, new_state, value)

    def trigger_alert(self, name: str, old_state: str, new_state: str, current_value: float) -> None:
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        message = f"[{timestamp}] ALERT: {name} transitioned from {old_state} -> {new_state} (Value: {current_value:.2f})"
        
        # Print warning/critical state changes to console
        print(message)
        
        # Append to local file
        try:
            with open(self.alert_log_path, "a", encoding="utf-8") as f:
                f.write(message + "\n")
        except Exception as e:
            print(f"Failed to write alert to log: {e}")
