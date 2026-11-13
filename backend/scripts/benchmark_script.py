import time
import urllib.request
import urllib.error
import statistics

endpoints = [
    ("Frontend: Landing Page", "https://atlas.progeni.live/"),
    ("Frontend: Candidate Dashboard", "https://atlas.progeni.live/candidate/dashboard"),
    ("Backend: Root Index (/)", "https://api-atlas.progeni.live/"),
    ("Backend: Ping Probe (/ping)", "https://api-atlas.progeni.live/ping"),
    ("Backend: API Ping Probe (/api/ping)", "https://api-atlas.progeni.live/api/ping"),
    ("Backend: Candidate Dashboard API", "https://api-atlas.progeni.live/api/candidate/dashboard"),
    ("Backend: Candidate Notifications API", "https://api-atlas.progeni.live/api/candidate/notifications"),
    ("Backend: Candidate Resume API", "https://api-atlas.progeni.live/api/candidate/resume"),
    ("Backend: Candidate Interviews API", "https://api-atlas.progeni.live/api/candidate/interviews"),
]


def main():
    print(f"{'Endpoint':<38} | {'HTTP':<5} | {'Avg (ms)':<9} | {'Min (ms)':<9} | {'Max (ms)':<9} | {'Jitter':<7}")
    print("-" * 85)

    for name, url in endpoints:
        times = []
        status = 0
        for _ in range(3):
            t0 = time.time()
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 LatencyCheck"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    elapsed = (time.time() - t0) * 1000
                    status = resp.status
                    times.append(elapsed)
            except urllib.error.HTTPError as e:
                elapsed = (time.time() - t0) * 1000
                status = e.code
                times.append(elapsed)
            except Exception:
                elapsed = (time.time() - t0) * 1000
                status = "ERR"
                times.append(elapsed)
            time.sleep(0.05)

        avg_t = statistics.mean(times)
        min_t = min(times)
        max_t = max(times)
        jitter = max_t - min_t
        print(f"{name:<38} | {status:<5} | {avg_t:<9.1f} | {min_t:<9.1f} | {max_t:<9.1f} | {jitter:<7.1f}")


if __name__ == "__main__":
    main()
