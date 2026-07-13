import os
import re
import time
import threading
from collections import deque
import psutil
from typing import Any, Tuple

class CPUCollector:
    @staticmethod
    def collect() -> float:
        return psutil.cpu_percent(interval=None)

class MemoryCollector:
    @staticmethod
    def collect() -> float:
        return psutil.virtual_memory().percent

class LogFileCollector:
    def __init__(self, filepath: str, window_seconds: int = 300):
        self.filepath = os.path.abspath(filepath)
        self.window_seconds = window_seconds
        self.errors: deque = deque()
        self.lock = threading.Lock()
        self.running = False
        self.thread = None

        # Create file if it doesn't exist
        directory = os.path.dirname(self.filepath)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
        if not os.path.exists(self.filepath):
            with open(self.filepath, "w", encoding="utf-8") as f:
                pass

    def start(self) -> None:
        self.running = True
        self.thread = threading.Thread(target=self._tail_file, daemon=True)
        self.thread.start()

    def stop(self) -> None:
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)

    def _tail_file(self) -> None:
        try:
            with open(self.filepath, "r", encoding="utf-8") as f:
                # Seek to end of file
                f.seek(0, os.SEEK_END)
                while self.running:
                    line = f.readline()
                    if not line:
                        time.sleep(0.1)
                        continue
                    
                    if "ERROR" in line.upper() or "EXCEPTION" in line.upper():
                        with self.lock:
                            self.errors.append(time.time())
        except Exception as e:
            print(f"Error in LogFileCollector tailing {self.filepath}: {e}")

    def get_error_count(self) -> int:
        now = time.time()
        cutoff = now - self.window_seconds
        with self.lock:
            while self.errors and self.errors[0] < cutoff:
                self.errors.popleft()
            return len(self.errors)

class WebAccessLogCollector:
    def __init__(self, filepath: str, window_seconds: int = 300):
        self.filepath = os.path.abspath(filepath)
        self.window_seconds = window_seconds
        self.requests: deque = deque()
        self.lock = threading.Lock()
        self.running = False
        self.thread = None
        self.latency_regex = re.compile(r"(\d+)ms")

        # Create file if it doesn't exist
        directory = os.path.dirname(self.filepath)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
        if not os.path.exists(self.filepath):
            with open(self.filepath, "w", encoding="utf-8") as f:
                pass

    def start(self) -> None:
        self.running = True
        self.thread = threading.Thread(target=self._tail_file, daemon=True)
        self.thread.start()

    def stop(self) -> None:
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)

    def _tail_file(self) -> None:
        try:
            with open(self.filepath, "r", encoding="utf-8") as f:
                f.seek(0, os.SEEK_END)
                while self.running:
                    line = f.readline()
                    if not line:
                        time.sleep(0.1)
                        continue
                    
                    match = self.latency_regex.search(line)
                    if match:
                        try:
                            latency = float(match.group(1))
                            with self.lock:
                                self.requests.append((time.time(), latency))
                        except ValueError:
                            pass
        except Exception as e:
            print(f"Error in WebAccessLogCollector tailing {self.filepath}: {e}")

    def get_average_latency(self) -> float:
        now = time.time()
        cutoff = now - self.window_seconds
        with self.lock:
            while self.requests and self.requests[0][0] < cutoff:
                self.requests.popleft()
            if not self.requests:
                return 0.0
            total_latency = sum(req[1] for req in self.requests)
            return total_latency / len(self.requests)
