#!/bin/sh
# Временный диагностический скрипт: показывает окружение процесса artisan serve.
for p in $(ls /proc); do
  case "$p" in
    *[!0-9]*) continue ;;
  esac
  if cat "/proc/$p/cmdline" 2>/dev/null | grep -qa 'artisan'; then
    echo "PID=$p"
    cat "/proc/$p/cmdline" 2>/dev/null | tr '\0' ' '
    echo ""
    echo "DB_HOST in environ:"
    cat "/proc/$p/environ" 2>/dev/null | tr '\0' '\n' | grep '^DB_HOST='
    echo "APP_URL in environ:"
    cat "/proc/$p/environ" 2>/dev/null | tr '\0' '\n' | grep '^APP_URL='
    echo "---"
  fi
done
