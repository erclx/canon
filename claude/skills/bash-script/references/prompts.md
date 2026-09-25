# Bash script prompts

Interactive prompt templates for the `bash-script` skill, read only when the script prompts. Copy verbatim, alongside the colors and logging functions from `patterns.md`.

Both prompts transition `◆` to `◇`, guard against non-TTY stdin with `[ -t 0 ]`, and write UI to stderr.

```bash
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
```

```bash
select_option() {
  local prompt_text=$1
  shift
  local options=("$@")
  local cur=0
  local count=${#options[@]}

  if [ ! -t 0 ]; then
    log_error "${prompt_text} requires a TTY"
  fi

  echo -ne "${GREY}│${NC}\n${GREEN}◆${NC} ${prompt_text}\n" >&2

  while true; do
    for i in "${!options[@]}"; do
      if [ "$i" -eq "$cur" ]; then
        echo -e "${GREY}│${NC}  ${GREEN}❯ ${options[$i]}${NC}" >&2
      else
        echo -e "${GREY}│${NC}    ${GREY}${options[$i]}${NC}" >&2
      fi
    done

    read -rsn1 key
    case "$key" in
      $'\x1b')
        if read -rsn2 -t 0.001 key_seq; then
          if [[ "$key_seq" == "[A" ]]; then cur=$(( (cur - 1 + count) % count )); fi
          if [[ "$key_seq" == "[B" ]]; then cur=$(( (cur + 1) % count )); fi
        else
          echo -en "\033[$((count + 1))A\033[J" >&2
          echo -e "\033[1A${GREY}│${NC}\n${GREY}◇${NC} ${prompt_text} ${RED}Cancelled${NC}" >&2
          exit 1
        fi
        ;;
      "k") cur=$(( (cur - 1 + count) % count ));;
      "j") cur=$(( (cur + 1) % count ));;
      "q")
        echo -en "\033[$((count + 1))A\033[J" >&2
        echo -e "\033[1A${GREY}│${NC}\n${GREY}◇${NC} ${prompt_text} ${RED}Cancelled${NC}" >&2
        exit 1
        ;;
      "") break ;;
    esac

    echo -en "\033[${count}A" >&2
  done

  echo -en "\033[$((count + 1))A\033[J" >&2
  echo -e "\033[1A${GREY}│${NC}\n${GREY}◇${NC} ${prompt_text} ${WHITE}${options[$cur]}${NC}" >&2
  SELECTED_OPTION="${options[$cur]}"
}
```
