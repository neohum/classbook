import os
import sys
import json
import datetime
import subprocess

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def load_env(env_files=None):
    if env_files is None:
        env_files = [".env.r2", ".env"]
    env = {}
    for env_path in env_files:
        if os.path.exists(env_path):
            with open(env_path, encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if '=' in line and not line.startswith('#'):
                        k, v = line.split('=', 1)
                        key = k.strip()
                        val = v.strip().strip('"').strip("'")
                        if key not in env or not env[key]:
                            env[key] = val
    return env

def read_version():
    with open("wails.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("info", {}).get("productVersion", "1.2.26")

def read_existing_notes():
    for fpath in ["version.json", os.path.join("build", "bin", "version.json")]:
        if os.path.exists(fpath):
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if "notes" in data and data["notes"]:
                        return data["notes"]
            except Exception:
                pass
    return "양쪽 메뉴바(좌/우)에 반대편 페이지 넘김 버튼 추가 (좌측 메뉴: 이전/다음 쪽, 우측 메뉴: 다음/이전 쪽 모두 지원) (v1.2.26)"

def run_cmd(args, env, check=True):
    res = subprocess.run(args, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check and res.returncode != 0:
        print(f"Command failed: {' '.join(args)}")
        print(f"STDERR: {res.stderr}")
        print(f"STDOUT: {res.stdout}")
        sys.exit(res.returncode)
    return res

def main():
    env_vars = load_env()

    account_id = env_vars.get('R2_ACCOUNT_ID', '9d5d05a9b5b1b7fde0163c4d83849cab')
    endpoint = env_vars.get('R2_ENDPOINT') or f"https://{account_id}.r2.cloudflarestorage.com"
    access_key = env_vars.get('R2_ACCESS_KEY_ID') or env_vars.get('AWS_ACCESS_KEY_ID')
    secret_key = env_vars.get('R2_SECRET_ACCESS_KEY') or env_vars.get('AWS_SECRET_ACCESS_KEY')
    region = env_vars.get('R2_REGION', 'auto')
    presign_region = env_vars.get('R2_PRESIGN_REGION', 'us-east-1')

    if not access_key or not secret_key:
        print("Error: Cloudflare R2 credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) missing in .env.r2 / .env")
        sys.exit(1)

    version = read_version()
    installer_name = f"classbook-setup-v{version}.exe"
    local_installer = os.path.join("build", "bin", installer_name)
    if not os.path.exists(local_installer):
        print(f"Error: Installer not found at {local_installer}")
        sys.exit(1)

    notes = read_existing_notes()
    today_str = datetime.date.today().strftime("%Y-%m-%d")

    # Prepare AWS CLI environment
    cmd_env = os.environ.copy()
    cmd_env["AWS_ACCESS_KEY_ID"] = access_key
    cmd_env["AWS_SECRET_ACCESS_KEY"] = secret_key
    cmd_env["AWS_DEFAULT_REGION"] = region

    installer_targets = [
        ("edulinkermessenger", f"exports/classbook/{installer_name}"),
        ("classbook", installer_name),
        ("classbook", f"exports/classbook/{installer_name}")
    ]

    version_targets = [
        ("edulinkermessenger", "exports/classbook/version.json"),
        ("classbook", "version.json"),
        ("classbook", "exports/classbook/version.json")
    ]

    print("==================================================")
    print(f"  Cloudflare R2 Release Upload - Classbook v{version}")
    print("==================================================")
    print(f"Installer: {local_installer} ({os.path.getsize(local_installer):,} bytes)")
    print(f"Endpoint:  {endpoint}")
    print()

    # 1. Upload installer to R2 targets
    for bucket, s3_key in installer_targets:
        target_uri = f"s3://{bucket}/{s3_key}"
        print(f"Uploading installer to {target_uri} ...")
        res = subprocess.run([
            "aws", "s3", "cp", local_installer, target_uri,
            "--endpoint-url", endpoint,
            "--content-type", "application/vnd.microsoft.portable-executable"
        ], env=cmd_env, capture_output=True, text=True, encoding="utf-8", errors="replace")

        if res.returncode != 0:
            print(f"❌ Failed to upload installer to {target_uri}:", res.stderr or res.stdout)
            sys.exit(res.returncode)
        else:
            print(f"✔ Upload complete: {target_uri}")

    print()

    # 2. Generate 7-day presigned URLs for installer
    print("Generating 7-day presigned URLs for installer...")
    presigned_urls = {}
    for bucket, s3_key in installer_targets:
        target_uri = f"s3://{bucket}/{s3_key}"
        res_presign = subprocess.run([
            "aws", "s3", "presign", target_uri,
            "--endpoint-url", endpoint,
            "--region", presign_region,
            "--expires-in", "604800"
        ], env=cmd_env, capture_output=True, text=True, encoding="utf-8", errors="replace")
        
        if res_presign.returncode == 0:
            url = res_presign.stdout.strip()
            presigned_urls[target_uri] = url
            print(f"  {target_uri}:\n    {url}")
        else:
            print(f"⚠ Failed to generate presigned URL for {target_uri}: {res_presign.stderr}")

    print()

    # 3. Publish to GitHub Releases (if gh is logged in)
    github_download_url = f"https://github.com/neohum/classbook/releases/download/v{version}/{installer_name}"
    tag_name = f"v{version}"
    print(f"Checking GitHub release {tag_name}...")
    chk_release = subprocess.run(["gh", "release", "view", tag_name], capture_output=True, text=True, encoding="utf-8", errors="ignore")
    if chk_release.returncode == 0:
        print(f"Updating existing GitHub release {tag_name}...")
        subprocess.run(["gh", "release", "upload", tag_name, local_installer, "--clobber"], check=False)
        subprocess.run(["gh", "release", "edit", tag_name, "--latest", "--notes", notes], check=False)
        print(f"✔ GitHub Release updated: {github_download_url}")
    else:
        print(f"Creating new GitHub release {tag_name}...")
        res_gh = subprocess.run([
            "gh", "release", "create", tag_name, local_installer,
            "--title", tag_name,
            "--notes", notes,
            "--latest"
        ], capture_output=True, text=True, encoding="utf-8", errors="ignore")
        if res_gh.returncode == 0:
            print(f"✔ GitHub Release published: {github_download_url}")
        else:
            print(f"⚠ GitHub Release skipped/failed (will continue with R2): {res_gh.stderr.strip()}")

    print()

    # 4. Generate version.json
    presigned_cb = presigned_urls.get(f"s3://classbook/{installer_name}", "")
    presigned_em = presigned_urls.get(f"s3://edulinkermessenger/exports/classbook/{installer_name}", "")

    version_info = {
        "version": version,
        "releaseDate": today_str,
        "downloadUrl": github_download_url,
        "installerName": installer_name,
        "r2PresignedUrl": presigned_cb,
        "r2PresignedUrlEdulinker": presigned_em,
        "r2DirectUrl": f"{endpoint}/classbook/{installer_name}",
        "r2DirectUrlEdulinker": f"{endpoint}/edulinkermessenger/exports/classbook/{installer_name}",
        "notes": notes
    }

    local_version_file = os.path.join("build", "bin", "version.json")
    with open(local_version_file, "w", encoding="utf-8") as f:
        json.dump(version_info, f, ensure_ascii=False, indent=2)

    root_version_file = "version.json"
    with open(root_version_file, "w", encoding="utf-8") as f:
        json.dump(version_info, f, ensure_ascii=False, indent=2)

    print(f"✔ Generated local version.json ({local_version_file}, {root_version_file})")
    print()

    # 5. Upload version.json to R2 targets
    for bucket, s3_key in version_targets:
        target_uri = f"s3://{bucket}/{s3_key}"
        print(f"Uploading version.json to {target_uri} ...")
        res = subprocess.run([
            "aws", "s3", "cp", local_version_file, target_uri,
            "--endpoint-url", endpoint,
            "--content-type", "application/json"
        ], env=cmd_env, capture_output=True, text=True, encoding="utf-8", errors="replace")

        if res.returncode != 0:
            print(f"❌ Failed to upload version info to {target_uri}:", res.stderr or res.stdout)
            sys.exit(res.returncode)
        else:
            print(f"✔ Upload complete: {target_uri}")

    print()

    # 6. Generate 7-day presigned URLs for version.json
    print("Generating 7-day presigned URLs for version.json...")
    version_presigned_urls = {}
    for bucket, s3_key in version_targets:
        target_uri = f"s3://{bucket}/{s3_key}"
        res_presign = subprocess.run([
            "aws", "s3", "presign", target_uri,
            "--endpoint-url", endpoint,
            "--region", presign_region,
            "--expires-in", "604800"
        ], env=cmd_env, capture_output=True, text=True, encoding="utf-8", errors="replace")
        
        if res_presign.returncode == 0:
            url = res_presign.stdout.strip()
            version_presigned_urls[target_uri] = url
            print(f"  {target_uri}:\n    {url}")

    print("\n🎉 Cloudflare R2 deployment successfully finished!")
    return {
        "version": version,
        "installer_presigned": presigned_urls,
        "version_presigned": version_presigned_urls
    }

if __name__ == "__main__":
    main()
