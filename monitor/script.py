import os
import random
import time
from datetime import datetime

def generate_logs() -> None:
    app_log = "app.log"
    access_log = "access.log"

    print("Starting mock log generator. Writing to 'app.log' and 'access.log'... Press Ctrl+C to stop.")

    log_levels = ["INFO", "INFO", "INFO", "DEBUG", "WARN", "ERROR", "EXCEPTION"]
    web_methods = ["GET", "POST", "PUT", "DELETE"]
    web_paths = [
        "/api/v1/auth/login",
        "/api/v1/tenant/onboard",
        "/api/v1/hierarchy",
        "/api/v1/auditlog",
        "/api/v1/health"
    ]
    web_statuses = [200, 200, 201, 204, 400, 401, 403, 500]

    try:
        while True:
            # 1. Write dummy app log
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            level = random.choice(log_levels)
            if level == "ERROR":
                msg = f"[{now}] [ERROR] Database connection pool exhausted or operation timed out."
            elif level == "EXCEPTION":
                msg = f"[{now}] [EXCEPTION] System.NullReferenceException: Object reference not set to an instance of an object.\n   at Aquora.API.Controllers.AuthController.Logout()"
            else:
                msg = f"[{now}] [{level}] Processing request for path {random.choice(web_paths)}"
            
            with open(app_log, "a", encoding="utf-8") as f:
                f.write(msg + "\n")

            # 2. Write dummy web access log
            web_now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            method = random.choice(web_methods)
            path = random.choice(web_paths)
            status = random.choice(web_statuses)
            # Normal latency: 50-300ms, Spike latency: 600-1500ms
            if random.random() < 0.15: # 15% chance of a latency spike
                latency = random.randint(600, 1500)
            else:
                latency = random.randint(30, 300)

            access_msg = f"[{web_now}] {method} {path} - {status} - {latency}ms"
            with open(access_log, "a", encoding="utf-8") as f:
                f.write(access_msg + "\n")

            time.sleep(random.uniform(0.5, 2.0))

    except KeyboardInterrupt:
        print("\nStopping mock log generator...")

if __name__ == "__main__":
    generate_logs()
