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

    installer_name = "classbook-setup-v1.2.0.exe"
    local_installer = os.path.join("build", "bin", installer_name)
    if not os.path.exists(local_installer):
        print(f"Error: Installer not found at {local_installer}")
        sys.exit(1)

    target_prefix = "exports/classbook"
    installer_s3_key = f"{target_prefix}/{installer_name}"
    version_s3_key = f"{target_prefix}/version.json"

    installer_url = f"{endpoint}/{bucket}/{installer_s3_key}"

    # Generate version.json
    version_info = {
        "version": "1.2.0",
        "releaseDate": "2026-09-28",
        "downloadUrl": installer_url,
        "installerName": installer_name,
        "notes": "상단 헤더 간소화(현재 과목/쪽수만 표시), 양쪽 사이드 컨트롤 배치, 주학습계획안 시간표 기반 자동 교과서 이동 및 시종/쉬는시간 알림 커스터마이징"
    }

    local_version_file = os.path.join("build", "bin", "version.json")
    with open(local_version_file, "w", encoding="utf-8") as f:
        json.dump(version_info, f, ensure_ascii=False, indent=2)

    # Prepare AWS CLI environment
    cmd_env = os.environ.copy()
    cmd_env["AWS_ACCESS_KEY_ID"] = access_key
    cmd_env["AWS_SECRET_ACCESS_KEY"] = secret_key
    cmd_env["AWS_DEFAULT_REGION"] = region

    print(f"Uploading installer {installer_name} to s3://{bucket}/{installer_s3_key} ...")
    res_installer = subprocess.run([
        "aws", "s3", "cp", local_installer, f"s3://{bucket}/{installer_s3_key}",
        "--endpoint-url", endpoint,
        "--content-type", "application/vnd.microsoft.portable-executable"
    ], env=cmd_env, capture_output=True, text=True)

    if res_installer.returncode != 0:
        print("Failed to upload installer:", res_installer.stderr or res_installer.stdout)
        sys.exit(1)
    print("✔ Installer upload complete:", installer_url)

    print(f"Uploading version info to s3://{bucket}/{version_s3_key} ...")
    res_version = subprocess.run([
        "aws", "s3", "cp", local_version_file, f"s3://{bucket}/{version_s3_key}",
        "--endpoint-url", endpoint,
        "--content-type", "application/json"
    ], env=cmd_env, capture_output=True, text=True)

    if res_version.returncode != 0:
        print("Failed to upload version info:", res_version.stderr or res_version.stdout)
        sys.exit(1)
    print("✔ Version info upload complete:", f"{endpoint}/{bucket}/{version_s3_key}")
    print("\n🎉 Wasabi deployment successfully finished!")

if __name__ == "__main__":
    main()
