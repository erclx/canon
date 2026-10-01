#!/bin/bash
exec bun "$(dirname "$0")/verify.ts" "$@"
