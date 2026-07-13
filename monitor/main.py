import argparse
import os
import time
import sys
from typing import Dict, Any

from configuration import load_config
from collectors import CPUCollector, MemoryCollector, LogFileCollector, WebAccessLogCollector
from alerts import AlertManager

def main() -> None:
    parser = argparse.ArgumentParser(description="Aquora System Performance Monitor")
    parser.add_argument("--config", default="config.yml", help="Path to config.yml file")
    parser.add_argument("--dryrun", action="store_true", help="Perform a single metric check and print values, then exit")
    parser.add_argument("--view-metrics", action="store_true", help="Print live metrics to console on every poll interval")
    args = parser.parse_args()

    # Determine absolute config path or resolve relative to file location
    config_path = args.config
    if not os.path.isabs(config_path):
        # check if it exists in current dir, otherwise relative to script
        if not os.path.exists(config_path):
            script_dir = os.path.dirname(os.path.abspath(__file__))
            config_path = os.path.join(script_dir, args.config)

    # Load configuration
    try:
        config = load_config(config_path)
    except Exception as e:
        print(f"Error loading configuration: {e}")
        sys.exit(1)

    # Extract configuration attributes
    log_file = config.DEFAULT_LOG_FILE
    access_log = config.DEFAULT_ACCESS_LOG
    alert_log = config.ALERT_LOG_FILE
    poll_interval = config.POLL_INTERVAL_SECONDS

    # Get thresholds settings
    thresholds: Dict[str, Any] = {
        "CPU": {
            "WARNING": config.THRESHOLDS.CPU.WARNING,
            "CRITICAL": config.THRESHOLDS.CPU.CRITICAL
        },
        "MEMORY": {
            "WARNING": config.THRESHOLDS.MEMORY.WARNING,
            "CRITICAL": config.THRESHOLDS.MEMORY.CRITICAL
        },
        "LOG_ERRORS": {
            "WARNING": config.THRESHOLDS.LOG_ERRORS.WARNING,
            "CRITICAL": config.THRESHOLDS.LOG_ERRORS.CRITICAL,
            "WINDOW_SECONDS": config.THRESHOLDS.LOG_ERRORS.WINDOW_SECONDS
        },
        "WEB_LATENCY": {
            "WARNING": config.THRESHOLDS.WEB_LATENCY.WARNING,
            "CRITICAL": config.THRESHOLDS.WEB_LATENCY.CRITICAL,
            "WINDOW_SECONDS": config.THRESHOLDS.WEB_LATENCY.WINDOW_SECONDS
        }
    }

    # Initialize collectors
    cpu_collector = CPUCollector()
    memory_collector = MemoryCollector()
    log_collector = LogFileCollector(log_file, window_seconds=thresholds["LOG_ERRORS"]["WINDOW_SECONDS"])
    web_collector = WebAccessLogCollector(access_log, window_seconds=thresholds["WEB_LATENCY"]["WINDOW_SECONDS"])

    # Dry-run execution
    if args.dryrun:
        print("--- Aquora Monitor Dryrun ---")
        cpu_val = cpu_collector.collect()
        mem_val = memory_collector.collect()
        print(f"CPU Utilization: {cpu_val:.2f}%")
        print(f"Memory Usage:    {mem_val:.2f}%")
        print(f"Log Errors (last {thresholds['LOG_ERRORS']['WINDOW_SECONDS']}s): {log_collector.get_error_count()}")
        print(f"Web Latency (last {thresholds['WEB_LATENCY']['WINDOW_SECONDS']}s): {web_collector.get_average_latency():.2f}ms")
        sys.exit(0)

    # Start tailing threads
    log_collector.start()
    web_collector.start()

    alert_manager = AlertManager(alert_log, thresholds)

    print("Starting system performance monitoring... Press Ctrl+C to stop.")
    if args.view_metrics:
        print("Live metrics viewing is enabled.")

    try:
        while True:
            cpu_val = cpu_collector.collect()
            mem_val = memory_collector.collect()
            err_count = log_collector.get_error_count()
            avg_latency = web_collector.get_average_latency()

            # Evaluate thresholds and fire alerts
            alert_manager.evaluate_metric("CPU", cpu_val)
            alert_manager.evaluate_metric("MEMORY", mem_val)
            alert_manager.evaluate_metric("LOG_ERRORS", float(err_count))
            alert_manager.evaluate_metric("WEB_LATENCY", avg_latency)

            if args.view_metrics:
                print(f"[{time.strftime('%H:%M:%S')}] CPU: {cpu_val:.1f}%, Mem: {mem_val:.1f}%, Errors: {err_count}, Web Latency: {avg_latency:.1f}ms")

            time.sleep(poll_interval)

    except KeyboardInterrupt:
        print("\nStopping monitor...")
    finally:
        log_collector.stop()
        web_collector.stop()

if __name__ == "__main__":
    main()
