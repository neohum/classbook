import os
import sys
import json
import subprocess

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def load_env(env_path=".env"):
    env = {}
    if not os.path.exists(env_path):
        print(f"Error: {env_path} not found")
        sys.exit(1)
    with open(env_path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env[k] = v.strip().strip('"').strip("'")
    return env

def read_version():
    with open("wails.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("info", {}).get("productVersion", "1.2.1")

def main():
    env_vars = load_env()
    
    bucket = env_vars.get('WASABI_BUCKET', 'edulinkermessenger')
    endpoint = env_vars.get('WASABI_ENDPOINT', 'https://s3.ap-northeast-1.wasabisys.com')
    region = env_vars.get('WASABI_REGION', 'ap-northeast-1')
    access_key = env_vars.get('WASABI_ACCESS_KEY_ID') or env_vars.get('AWS_ACCESS_KEY_ID')
    secret_key = env_vars.get('WASABI_SECRET_ACCESS_KEY') or env_vars.get('AWS_SECRET_ACCESS_KEY')

    if not access_key or not secret_key:
        print("Error: Wasabi access key or secret key missing in .env")
        sys.exit(1)

    version = read_version()
    installer_name = f"classbook-setup-v{version}.exe"
    local_installer = os.path.join("build", "bin", installer_name)
    if not os.path.exists(local_installer):
        print(f"Error: Installer not found at {local_installer}")
        sys.exit(1)

    notes = "무인 자동 업데이트 기능 개선 (자동 감지, 백그라운드 다운로드, 무인 사일런트 설치 및 자동 재시작)"

    # Prepare AWS CLI environment
    cmd_env = os.environ.copy()
    cmd_env["AWS_ACCESS_KEY_ID"] = access_key
    cmd_env["AWS_SECRET_ACCESS_KEY"] = secret_key
    cmd_env["AWS_DEFAULT_REGION"] = region

    target_prefix = "exports/classbook"
    installer_s3_key = f"{target_prefix}/{installer_name}"
    version_s3_key = f"{target_prefix}/version.json"

    # 1. Upload installer to Wasabi
    print(f"Uploading installer {installer_name} to s3://{bucket}/{installer_s3_key} ...")
    res_installer = subprocess.run([
        "aws", "s3", "cp", local_installer, f"s3://{bucket}/{installer_s3_key}",
        "--endpoint-url", endpoint,
        "--content-type", "application/vnd.microsoft.portable-executable"
    ], env=cmd_env, capture_output=True, text=True)

    if res_installer.returncode != 0:
        print("Failed to upload installer to Wasabi:", res_installer.stderr or res_installer.stdout)
    else:
        print("✔ Wasabi Installer upload complete")

    # 2. Generate Wasabi presigned URL (valid 7 days)
    res_presign = subprocess.run([
        "aws", "s3", "presign", f"s3://{bucket}/{installer_s3_key}",
        "--endpoint-url", endpoint,
        "--expires-in", "604800"
    ], env=cmd_env, capture_output=True, text=True)
    presigned_url = res_presign.stdout.strip() if res_presign.returncode == 0 else ""

    # 3. Publish to GitHub Releases (100% public, high speed CDN, no auth needed for clients)
    github_download_url = f"https://github.com/neohum/classbook/releases/download/v{version}/{installer_name}"
    tag_name = f"v{version}"
    print(f"Publishing release {tag_name} to GitHub Releases...")
    
    # Check if release exists
    chk_release = subprocess.run(["gh", "release", "view", tag_name], capture_output=True, text=True)
    if chk_release.returncode == 0:
        print(f"Updating existing GitHub release {tag_name}...")
        subprocess.run(["gh", "release", "upload", tag_name, local_installer, "--clobber"], check=False)
        subprocess.run(["gh", "release", "edit", tag_name, "--latest", "--notes", notes], check=False)
    else:
        print(f"Creating new GitHub release {tag_name}...")
        subprocess.run([
            "gh", "release", "create", tag_name, local_installer,
            "--title", tag_name,
            "--notes", notes,
            "--latest"
        ], check=False)
    print(f"✔ GitHub Release published: {github_download_url}")

    # 4. Generate version.json
    version_info = {
        "version": version,
        "releaseDate": "2026-09-28",
        "downloadUrl": github_download_url,
        "installerName": installer_name,
        "wasabiPresignedUrl": presigned_url,
        "wasabiDirectUrl": f"{endpoint}/{bucket}/{installer_s3_key}",
        "notes": notes
    }

    local_version_file = os.path.join("build", "bin", "version.json")
    with open(local_version_file, "w", encoding="utf-8") as f:
        json.dump(version_info, f, ensure_ascii=False, indent=2)

    root_version_file = "version.json"
    with open(root_version_file, "w", encoding="utf-8") as f:
        json.dump(version_info, f, ensure_ascii=False, indent=2)

    # 5. Upload version info to Wasabi
    print(f"Uploading version info to s3://{bucket}/{version_s3_key} ...")
    res_version = subprocess.run([
        "aws", "s3", "cp", local_version_file, f"s3://{bucket}/{version_s3_key}",
        "--endpoint-url", endpoint,
        "--content-type", "application/json"
    ], env=cmd_env, capture_output=True, text=True)

    if res_version.returncode != 0:
        print("Failed to upload version info to Wasabi:", res_version.stderr or res_version.stdout)
    else:
        print("✔ Wasabi Version info upload complete")

    print("\n🎉 Wasabi & GitHub Release deployment successfully finished!")

if __name__ == "__main__":
    main()
