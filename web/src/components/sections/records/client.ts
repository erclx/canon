/**
 * A chip brings its record's page to the front. Every page takes its offset
 * from the front, wrapping round, so the fan always shows the two records
 * either side of the picked one, and the sheet reads the offset for its slot.
 */
const section = document.getElementById('records')
const chips = [...(section?.querySelectorAll<HTMLButtonElement>('.chip') ?? [])]
const sheets = [...(section?.querySelectorAll<HTMLElement>('.sheet') ?? [])]

const front = (picked: number) => {
  const half = Math.floor(sheets.length / 2)
  sheets.forEach((sheet, index) => {
    const at = ((index - picked + sheets.length + half) % sheets.length) - half
    sheet.dataset.at = String(at)
    if (at === 0) sheet.removeAttribute('aria-hidden')
    else sheet.setAttribute('aria-hidden', 'true')
  })
  chips.forEach((chip, index) =>
    chip.setAttribute('aria-pressed', String(index === picked)),
  )
}

chips.forEach((chip, index) =>
  chip.addEventListener('click', () => front(index)),
)
