"""Audit actual packaged demo classes while allowing the unchanged operational app.

Use the Android SDK's official dexdump tool. No decompilation is treated as a
device test; the report only establishes the inspected packaged boundaries.
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import zipfile

PREFIX = "Lnl/lattenspecialist/beheer/Demo"
EXPECTED = {
    "DemoActivity", "DemoOriginPolicy", "DemoIntentPolicy", "DemoNotificationPolicy",
    "DemoIntents", "DemoRequestNotification", "DemoAdminWidgetProvider", "DemoQuickRequestWidgetProvider",
}
FORBIDDEN = (
    "Lnl/lattenspecialist/beheer/MainActivity;", "Lnl/lattenspecialist/beheer/AdminWidgetProvider;",
    "Lnl/lattenspecialist/beheer/QuickRequestWidgetProvider;", "Lnl/lattenspecialist/beheer/RequestNotificationWorker;",
    "Landroidx/work/", "Landroid/webkit/JavascriptInterface;", "addJavascriptInterface",
    "Ljava/net/HttpURLConnection;", "Ljava/net/Socket;", "admin_token", "lattenspecialist_widget",
    "stuiterbaas-reserveren.stuiterbaas-456655a6.workers.dev", "https://lattenspecialist.nl",
    "https://app.pierfinity.nl", "https://pierfinity.nl",
)
ORIGIN = "https://lattenspecialist-admin-review.stuiterbaas-456655a6.workers.dev/"


def scan_section(lines, found, counts):
    section = "".join(lines)
    match = re.search(r"Class descriptor\s*:\s*'([^']+)'", section)
    if not match or not match.group(1).startswith(PREFIX):
        return
    descriptor = match.group(1)
    found[descriptor] = section
    for token in FORBIDDEN:
        if token in section:
            raise ValueError(f"Forbidden operational/network reference in packaged {descriptor}: {token}")
    counts["demoClasses"] += 1


def main():
    if len(sys.argv) != 3:
        raise ValueError("Expected actual AAB path and official SDK dexdump.exe path")
    artifact, dexdump = map(Path, sys.argv[1:])
    found = {}
    counts = {"dexFiles": 0, "demoClasses": 0}
    with tempfile.TemporaryDirectory(prefix="admin17-dex-audit-") as temporary:
        with zipfile.ZipFile(artifact) as archive:
            for entry in archive.infolist():
                if not re.fullmatch(r"base/dex/classes\d*\.dex", entry.filename):
                    continue
                if entry.file_size > 50_000_000:
                    raise ValueError("Unexpectedly large DEX")
                dex = Path(temporary) / Path(entry.filename).name
                dex.write_bytes(archive.read(entry))
                counts["dexFiles"] += 1
                process = subprocess.Popen([str(dexdump), "-d", str(dex)], stdout=subprocess.PIPE,
                                           stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
                section = []
                for line in process.stdout:
                    if re.match(r"^Class #\d+\s+-\s*$", line):
                        scan_section(section, found, counts)
                        section = []
                    section.append(line)
                scan_section(section, found, counts)
                error = process.stderr.read()
                if process.wait() != 0:
                    raise ValueError("Official dexdump failed: " + error[-1000:])
    if not counts["dexFiles"]:
        raise ValueError("No packaged DEX found")
    missing = EXPECTED - {name.split("/")[-1].split("$")[0].rstrip(";") for name in found}
    if missing:
        raise ValueError("Expected demo classes not audited: " + ", ".join(sorted(missing)))
    policy = found.get("Lnl/lattenspecialist/beheer/DemoOriginPolicy;", "")
    intents = found.get("Lnl/lattenspecialist/beheer/DemoIntents;", "")
    if ORIGIN not in policy or "Lnl/lattenspecialist/beheer/DemoActivity;" not in intents:
        raise ValueError("Packaged demo origin/intent target missing")
    print(json.dumps({"passed": True, **counts, "expectedTopLevelDemoClasses": len(EXPECTED),
                      "fixedDemoOriginPresent": True, "operationalReferencesInDemoClasses": 0,
                      "operationalAppIntentionallyIncludedOutsideDemoClasses": True,
                      "deviceRuntimeVerified": False}, indent=2))


if __name__ == "__main__":
    main()
