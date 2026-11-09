"""Inspect the actual AAB's demo storage guard with the official SDK dexdump."""
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import zipfile

PREFIX = "Lnl/lattenspecialist/medewerkers/Demo"
ACTIVITY = PREFIX + "Activity;"
FORBIDDEN = ("addJavascriptInterface", "Landroid/webkit/JavascriptInterface;", "Intent.ACTION_VIEW",
             "Ljava/net/HttpURLConnection;", "admin_token", "lattenspecialist_widget",
             "stuiterbaas-reserveren.stuiterbaas-456655a6.workers.dev", "https://app.pierfinity.nl")


def main():
    if len(sys.argv) != 3:
        raise ValueError("Expected actual AAB and official dexdump.exe")
    artifact, dexdump = map(Path, sys.argv[1:])
    found = {}

    def collect(lines):
        section = "".join(lines)
        match = re.search(r"Class descriptor\s*:\s*'([^']+)'", section)
        if match and match.group(1).startswith(PREFIX):
            for value in FORBIDDEN:
                if value in section:
                    raise ValueError("Forbidden reference in packaged demo: " + value)
            found[match.group(1)] = section

    with tempfile.TemporaryDirectory(prefix="staff13-dex-audit-") as temporary:
        with zipfile.ZipFile(artifact) as archive:
            for item in archive.infolist():
                if not re.fullmatch(r"base/dex/classes\d*\.dex", item.filename):
                    continue
                target = Path(temporary) / Path(item.filename).name
                target.write_bytes(archive.read(item))
                process = subprocess.Popen([str(dexdump), "-d", str(target)], stdout=subprocess.PIPE,
                                           stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
                lines = []
                for line in process.stdout:
                    if re.match(r"^Class #\d+\s+-\s*$", line):
                        collect(lines)
                        lines = []
                    lines.append(line)
                collect(lines)
                error = process.stderr.read()
                if process.wait() != 0:
                    raise ValueError("dexdump failed: " + error[-1000:])
    activity = found.get(ACTIVITY, "")
    if not activity:
        raise ValueError("Packaged DemoActivity is absent")
    # Each DEX method is introduced by its name. Inspect only the guard's own body.
    guard = re.search(r"name\s*:\s*'prepareDemoStorage'(?P<body>.*?)(?=\n\s*#\d+\s*:|\n\s*Virtual methods|\Z)", activity, re.S)
    if not guard:
        raise ValueError("Actual packaged one-time storage guard is absent")
    body = guard.group("body")
    for required in ["sget-boolean", "dataDirectoryReady", "if-nez", "setDataDirectorySuffix", "sput-boolean"]:
        if required not in body:
            raise ValueError("Packaged guard lacks " + required)
    if not (body.index("sget-boolean") < body.index("if-nez") < body.index("setDataDirectorySuffix") < body.index("sput-boolean")):
        raise ValueError("Guard does not check process state before setting suffix")
    if "STATIC" not in body or "SYNCHRONIZED" not in body:
        raise ValueError("Packaged initializer is not static and synchronized")
    on_create = re.search(r"name\s*:\s*'onCreate'(?P<body>.*?)(?=\n\s*#\d+\s*:|\Z)", activity, re.S)
    if not on_create or not (0 <= on_create.group("body").find("prepareDemoStorage") < on_create.group("body").find("configure")):
        raise ValueError("Actual onCreate does not guard before WebView setup")
    if "setDataDirectorySuffix" in on_create.group("body"):
        raise ValueError("Actual onCreate still calls WebView suffix unconditionally")
    print(json.dumps({"passed": True, "demoClassesInspected": len(found), "staticSynchronizedGuard": True,
                      "processFlagCheckedBeforeSuffix": True, "onCreateCallsGuardBeforeConfigure": True,
                      "unconditionalOnCreateSuffixCall": False, "forbiddenDemoReferences": 0,
                      "deviceRuntimeVerified": False}, indent=2))


if __name__ == "__main__":
    main()
