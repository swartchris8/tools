# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "whisply @ git+https://github.com/tsmdt/whisply.git",
# ]
# ///

import subprocess
import sys

def main():
    try:
        subprocess.run(["whisply", "--launch_app"], check=True)
    except KeyboardInterrupt:
        sys.exit(0)

if __name__ == "__main__":
    main()
