#!/bin/sh
# Copy your screen recording into the portfolio folder cover slot.
# Usage: ./scripts/install-member-rewards-video.sh "/path/to/MemberRewards (1) (1).mp4"

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/assets/case-studies/beem/MemberRewards (1) (1).mp4"

if [ -z "$1" ]; then
  echo "Usage: $0 \"/full/path/to/MemberRewards (1) (1).mp4\""
  echo "Destination: $DEST"
  exit 1
fi

if [ ! -f "$1" ]; then
  echo "Source file not found: $1"
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
cp "$1" "$DEST"
echo "Installed $(du -h "$DEST" | cut -f1) -> assets/case-studies/beem/MemberRewards (1) (1).mp4"