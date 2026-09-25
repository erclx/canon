# Bash script patterns

Code templates for the `bash-script` skill. Copy verbatim, keeping only the colors and functions the script uses.

## Timeline structure

```plaintext
┌                    # Start boundary (alone on its own line)
│ Title              # Script or context title (immediately after ┌)
│                    # Persistent vertical line (grey)
├ Section Branch     # Section headers (no diamond)
│ ✓ Log message      # Info/success logs
│ ! Warning          # Warning logs
│ ✗ Error            # Error logs
└                    # End boundary
```

## Color palette

Define only the colors the script uses from this set:

```bash
GREEN='\033[0;32m'      # Success/Active
RED='\033[0;31m'        # Error/Delete
YELLOW='\033[0;33m'     # Warning
WHITE='\033[1;37m'      # Active text
GREY='\033[0;90m'       # Timeline/Inactive
CYAN='\033[0;36m'       # Optional accent
MAGENTA='\033[0;35m'    # Optional highlight
NC='\033[0m'            # Reset
```

## Timeline lifecycle

Define `open_timeline` and `close_timeline`. Call `open_timeline "Title"` at the start of `main()`, then register `close_timeline` as the EXIT trap. The trap guarantees `└` prints on every exit path: normal completion, `exit 1` from cancellation, or unexpected errors. Do not print `└` manually anywhere else.

```bash
open_timeline() {
  echo -e "${GREY}┌${NC}" >&2
  [ -n "${1:-}" ] && echo -e "${GREY}│${NC} ${WHITE}$1${NC}" >&2
}

close_timeline() {
  echo -e "${GREY}└${NC}" >&2
}
```

Register the trap inside `main()` right after opening:

```bash
open_timeline "Script title"
trap close_timeline EXIT
```

## Logging

All log functions include the `│` prefix and write to stderr.

```bash
log_info()  { echo -e "${GREY}│${NC} ${GREEN}✓${NC} $1" >&2; }
log_warn()  { echo -e "${GREY}│${NC} ${YELLOW}!${NC} $1" >&2; }
log_error() { echo -e "${GREY}│${NC} ${RED}✗${NC} $1" >&2; exit 1; }
log_step()  { echo -e "${GREY}│${NC}\n${GREY}├${NC} ${WHITE}$1${NC}" >&2; }
log_add()   { echo -e "${GREY}│${NC} ${GREEN}+${NC} $1" >&2; }
log_rem()   { echo -e "${GREY}│${NC} ${RED}-${NC} $1" >&2; }
```

## Section headers

Use `log_step` for every section header, including the first. It emits a leading blank `│` line to separate the banner from the first section and to give breathing room between subsequent sections:

```bash
open_timeline "Script title"
trap close_timeline EXIT

log_step "Deploy"
log_step "Verify"
```

Renders as:

```plaintext
┌
│ Script title
│
├ Deploy
...
│
├ Verify
...
└
```

## Help system

```bash
show_help() {
  echo -e "${GREY}┌${NC}"
  echo -e "${GREY}├${NC} ${WHITE}Usage:${NC} ./script.sh [options]"
  echo -e "${GREY}│${NC}"
  echo -e "${GREY}│${NC}  ${WHITE}Options:${NC}"
  echo -e "${GREY}│${NC}    -h, --help    ${GREY}# Show this help message${NC}"
  echo -e "${GREY}│${NC}    [flag]        ${GREY}# [Description]${NC}"
  echo -e "${GREY}└${NC}"
  exit 0
}
```

## Error handling helper

```bash
run_check() {
  local cmd=$1
  local err_msg=$2
  if ! eval "$cmd"; then
    log_error "$err_msg"
  fi
}
```

## Full script structure

```bash
#!/usr/bin/env bash
set -e
set -o pipefail

[Color definitions - only used colors]

[Function definitions - only needed functions]

open_timeline() {
  echo -e "${GREY}┌${NC}" >&2
  [ -n "${1:-}" ] && echo -e "${GREY}│${NC} ${WHITE}$1${NC}" >&2
}

close_timeline() {
  echo -e "${GREY}└${NC}" >&2
}

check_dependencies() {
  [Verify required tools installed]
}

main() {
  check_dependencies

  open_timeline "Script title"
  trap close_timeline EXIT

  log_step "First section"
  [Script logic with timeline maintained]

  trap - EXIT
  echo -e "${GREY}└${NC}\n" >&2
  echo -e "${GREEN}✓ Final success message${NC}"
}

main "$@"
```

## Worked example

```bash
#!/usr/bin/env bash
set -e
set -o pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
WHITE='\033[1;37m'
GREY='\033[0;90m'
NC='\033[0m'

log_info()  { echo -e "${GREY}│${NC} ${GREEN}✓${NC} $1" >&2; }
log_error() { echo -e "${GREY}│${NC} ${RED}✗${NC} $1" >&2; exit 1; }
log_step()  { echo -e "${GREY}│${NC}\n${GREY}├${NC} ${WHITE}$1${NC}" >&2; }
log_add()   { echo -e "${GREY}│${NC} ${GREEN}+${NC} $1" >&2; }

open_timeline() {
  echo -e "${GREY}┌${NC}" >&2
  [ -n "${1:-}" ] && echo -e "${GREY}│${NC} ${WHITE}$1${NC}" >&2
}

close_timeline() {
  echo -e "${GREY}└${NC}" >&2
}

ask() {
  local prompt_text=$1
  local var_name=$2
  local default_val=$3
  local input=""
  local char
  local display_default=""
  if [ -n "$default_val" ]; then
    display_default=" (${default_val})"
  fi
  if [ ! -t 0 ]; then
    log_error "${prompt_text} requires a TTY"
  fi
  echo -e "${GREY}│${NC}" >&2
  echo -ne "${GREEN}◆${NC} ${prompt_text}${display_default} " >&2
  while IFS= read -r -s -n1 char; do
    if [[ $char == $'\x1b' ]]; then
      read -rsn2 -t 0.001 _ || true
      echo -ne "\r\033[K" >&2
      echo -e "${GREY}◇${NC} ${prompt_text} ${RED}Cancelled${NC}" >&2
      exit 1
    elif [[ $char == $'\x7f' || $char == $'\x08' ]]; then
      if [ -n "$input" ]; then
        input="${input%?}"
        echo -ne "\b \b" >&2
      fi
    elif [[ -z "$char" ]]; then
      break
    else
      input+="$char"
      echo -n "$char" >&2
    fi
  done
  [ -z "$input" ] && input="$default_val"
  echo -ne "\r\033[K" >&2
  echo -e "${GREY}◇${NC} ${prompt_text} ${WHITE}${input}${NC}" >&2
  export "$var_name"="$input"
}

check_dependencies() {
  command -v npm >/dev/null 2>&1 || log_error "npm not installed"
}

main() {
  check_dependencies

  open_timeline "Project Setup"
  trap close_timeline EXIT

  ask "Project name?" "PROJECT_NAME" "my-app"

  log_step "Installing dependencies"
  npm install vite
  log_add "vite@latest"

  log_info "Setup complete"
  echo -e "\n${GREEN}✓ Project created successfully${NC}"
}

main "$@"
```
