import subprocess
import time

print("Starting WhatsApp Bot Node.js server...")
subprocess.run(["npm", "install"])

print("Running index.js...")
process = subprocess.Popen(["node", "index.js"])
process.wait()
