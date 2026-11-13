#!/usr/bin/env bash
# Render build script: runs on every deploy, from the backend/ directory.
set -o errexit

pip install -r requirements/production.txt

python manage.py collectstatic --no-input
python manage.py migrate --no-input

# Load the demo marketplace once, on an empty database. Later deploys leave data alone.
USER_COUNT=$(python manage.py shell -c "from apps.users.models import User; print(User.objects.count())" | tail -n 1)
if [ "$USER_COUNT" = "0" ]; then
  python manage.py seed_demo
fi
