import pygetwindow as gw
import time

def run_lightweight_vision():
    print("🚀 Lightweight Context Sensor Online (Zero Resource Mode)...")
    last_window = ""

    while True:
        try:
            window = gw.getActiveWindow()
            if window and window.title:
                current_window = window.title
                
                # Only update if you've actually switched apps
                if current_window != last_window:
                    obs = f"[Active Window: {current_window}]"
                    with open("current_observation.txt", "w", encoding="utf-8") as f:
                        f.write(obs)
                    print(f"👁️ Context Updated: {current_window}")
                    last_window = current_window
        except Exception as e:
            pass
        
        time.sleep(5) # Check every 5 seconds

if __name__ == "__main__":
    run_lightweight_vision()