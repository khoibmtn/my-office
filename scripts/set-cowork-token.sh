#!/usr/bin/env bash
# Sinh token Cowork ngẫu nhiên (48 byte) và ghi vào credentials.local.json khoá "my_office".
# Giữ nguyên mọi khoá khác; file quyền 600; KHÔNG in token ra màn hình.
#
# Dùng:  scripts/set-cowork-token.sh [--base-url https://my-office-inky.vercel.app]
#        CREDENTIALS_FILE=/đường/dẫn/khác.json scripts/set-cowork-token.sh   (tuỳ chọn)
set -euo pipefail

DEFAULT_BASE_URL="https://my-office-inky.vercel.app"
CRED_FILE="${CREDENTIALS_FILE:-/Users/buiminhkhoi/Documents/Claude/KHTH/config/credentials.local.json}"
BASE_URL="$DEFAULT_BASE_URL"

while [ $# -gt 0 ]; do
  case "$1" in
    --base-url) BASE_URL="${2:-}"; shift 2 ;;
    --base-url=*) BASE_URL="${1#*=}"; shift ;;
    -h|--help) sed -n '2,7p' "$0"; exit 0 ;;
    *) echo "Tham số không hiểu: $1" >&2; exit 2 ;;
  esac
done

CRED_FILE="$CRED_FILE" BASE_URL="$BASE_URL" python3 - <<'PY'
import json, os, secrets, sys, tempfile

path = os.environ["CRED_FILE"]
base_url = os.environ["BASE_URL"].strip().rstrip("/")
if not base_url.startswith(("https://", "http://localhost", "http://127.0.0.1")):
    sys.exit("base-url phải bắt đầu bằng https://")

data = {}
if os.path.exists(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        sys.exit("credentials.local.json không phải object JSON — dừng, không ghi.")
os.makedirs(os.path.dirname(path), exist_ok=True)

data["my_office"] = {"base_url": base_url, "cowork_token": secrets.token_urlsafe(48)}

fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".cred-", suffix=".tmp")
try:
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)
except BaseException:
    if os.path.exists(tmp):
        os.unlink(tmp)
    raise
os.chmod(path, 0o600)
print(f"Đã ghi khoá my_office (base_url={base_url}) vào {path} (quyền 600). Token không được in.")
PY

cat <<EOM

BƯỚC TIẾP THEO — đặt biến COWORK_API_TOKEN trên Vercel (token đọc từ file, không hiện ra màn hình):

  cd "$(cd "$(dirname "$0")/.." && pwd)"
  python3 -c 'import json,sys;sys.stdout.write(json.load(open(sys.argv[1]))["my_office"]["cowork_token"])' "$CRED_FILE" \\
    | vercel env add COWORK_API_TOKEN production

Rồi deploy lại để biến có hiệu lực:  vercel --prod
Nếu đang xoay token: đặt token cũ vào COWORK_API_TOKEN_NEXT trước, đổi, rồi xoá _NEXT.
Cuối cùng khởi động lại Claude Desktop để MCP "my-office" đọc token mới.
EOM
