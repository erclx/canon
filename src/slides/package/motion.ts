/**
 * Slide transitions and entrance animations, written into a slide's XML after
 * pptxgenjs has written it, since pptxgenjs declares neither. A slide states
 * them in its HTML, `walk.ts` reads the attributes, and the converter resolves
 * each animated element to the object names `planSlide` gave its shapes. This
 * module turns those names into the shape ids the written XML assigned.
 */

export interface TransitionSpec {
  readonly effect: string
  readonly duration?: string
}

export interface EntranceSpec {
  /** The element that declared it, which every notice names. */
  readonly selector: string
  readonly effect: string
  readonly order?: string
  readonly duration?: string
  /** Every shape drawn from the element and the elements inside it. */
  readonly shapes: readonly string[]
}

export interface SlideMotion {
  readonly transition?: TransitionSpec
  readonly entrances: readonly EntranceSpec[]
}

export interface MotionResult {
  readonly xml: string
  readonly notices: readonly string[]
}

/** The child element `<p:transition>` holds, each in its default direction. */
const TRANSITIONS: Readonly<Record<string, string>> = {
  fade: '<p:fade/>',
  push: '<p:push/>',
  wipe: '<p:wipe/>',
  cover: '<p:cover/>',
}

/**
 * The strict schema states a transition's length only as one of three speeds,
 * 0.5, 0.75, and 1 second. A length in milliseconds needs the PowerPoint 2010
 * extension namespace, so a declared duration rounds to the nearest speed.
 */
function speedOf(duration: number | undefined): 'fast' | 'med' | 'slow' {
  if (duration === undefined) return 'med'
  if (duration < 625) return 'fast'
  return duration < 875 ? 'med' : 'slow'
}

type Behaviors = (spid: string, duration: number, next: () => number) => string

const target = (spid: string): string =>
  `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>`

const animEffect =
  (filter: string): Behaviors =>
  (spid, duration, next) =>
    `<p:animEffect transition="in" filter="${filter}"><p:cBhvr><p:cTn id="${next()}" dur="${duration}"/>${target(spid)}</p:cBhvr></p:animEffect>`

function anim(
  spid: string,
  duration: number,
  id: number,
  attribute: string,
  from: string,
  to: string,
): string {
  return `<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="${id}" dur="${duration}" fill="hold"/>${target(spid)}<p:attrNameLst><p:attrName>${attribute}</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst><p:tav tm="0"><p:val><p:strVal val="${from}"/></p:val></p:tav><p:tav tm="100000"><p:val><p:strVal val="${to}"/></p:val></p:tav></p:tavLst></p:anim>`
}

interface Preset {
  readonly id: number
  readonly subtype: number
  readonly behaviors: Behaviors
}

/**
 * PowerPoint's own preset ids, so the effect shows by name in its animation
 * pane. Fly comes in from the bottom and wipe from the left, the directions
 * PowerPoint picks when none is chosen.
 */
const ENTRANCES: Readonly<Record<string, Preset>> = {
  fade: { id: 10, subtype: 0, behaviors: animEffect('fade') },
  fly: {
    id: 2,
    subtype: 4,
    behaviors: (spid, duration, next) =>
      anim(spid, duration, next(), 'ppt_x', '#ppt_x', '#ppt_x') +
      anim(spid, duration, next(), 'ppt_y', '1+#ppt_h/2', '#ppt_y'),
  },
  wipe: { id: 22, subtype: 8, behaviors: animEffect('wipe(right)') },
  zoom: {
    id: 53,
    subtype: 16,
    behaviors: (spid, duration, next) =>
      anim(spid, duration, next(), 'ppt_w', '0', '#ppt_w') +
      anim(spid, duration, next(), 'ppt_h', '0', '#ppt_h') +
      animEffect('fade')(spid, duration, next),
  },
}

const DEFAULT_ENTRANCE_MS = 500

const ANCHOR = '</p:clrMapOvr>'

const list = (names: readonly string[]): string =>
  `${names.slice(0, -1).join(', ')}, or ${names.at(-1)}`

/** Milliseconds from `500`, `500ms`, or `0.5s`, or undefined when unreadable. */
export function millisecondsOf(value: string | undefined): number | undefined {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(ms|s)?\s*$/.exec(value ?? '')
  if (!match?.[1]) return undefined
  const amount = Number(match[1])
  return Math.round(match[2] === 's' ? amount * 1000 : amount)
}

function shapeIds(xml: string): Map<string, string> {
  const ids = new Map<string, string>()
  for (const [, id, name] of xml.matchAll(
    /<p:cNvPr id="(\d+)" name="([^"]*)"/g,
  )) {
    if (id && name && !ids.has(name)) ids.set(name, id)
  }
  return ids
}

interface Click {
  readonly preset: Preset
  readonly duration: number
  readonly spids: readonly string[]
}

function timingXml(clicks: readonly Click[]): string {
  let counter = 2
  const next = (): number => {
    counter += 1
    return counter
  }
  const pars = clicks.map((click) => {
    const outer = next()
    const inner = next()
    const effects = click.spids.map((spid, index) => {
      const nodeType = index === 0 ? 'clickEffect' : 'withEffect'
      const effect = next()
      const visible = `<p:set><p:cBhvr><p:cTn id="${next()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>${target(spid)}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>`
      const behaviors = click.preset.behaviors(spid, click.duration, next)
      return `<p:par><p:cTn id="${effect}" presetID="${click.preset.id}" presetClass="entr" presetSubtype="${click.preset.subtype}" fill="hold" nodeType="${nodeType}"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${visible}${behaviors}</p:childTnLst></p:cTn></p:par>`
    })
    return `<p:par><p:cTn id="${outer}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${inner}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${effects.join('')}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`
  })
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${pars.join('')}</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`
}

/** Declared order first, then document order for ties and for no order. */
function ordered(entrances: readonly EntranceSpec[]): EntranceSpec[] {
  const rank = (entrance: EntranceSpec): number => {
    const order = Number.parseFloat(entrance.order ?? '')
    return Number.isFinite(order) ? order : Number.POSITIVE_INFINITY
  }
  return entrances.toSorted((a, b) => rank(a) - rank(b))
}

/**
 * Inserts the transition and an on-click main sequence after the slide's color
 * map override, where the schema orders them. Each entrance is one click, and
 * every shape drawn from its element comes in on that click together. A slide
 * missing the anchor is returned unchanged rather than patched elsewhere.
 */
export function addMotion(xml: string, motion: SlideMotion): MotionResult {
  const notices: string[] = []
  let transition = ''
  if (motion.transition) {
    const element = TRANSITIONS[motion.transition.effect]
    if (element) {
      const speed = speedOf(millisecondsOf(motion.transition.duration))
      transition = `<p:transition spd="${speed}">${element}</p:transition>`
    } else {
      notices.push(
        `unknown transition ${motion.transition.effect}. Use ${list(Object.keys(TRANSITIONS))}`,
      )
    }
  }

  const ids = shapeIds(xml)
  const clicks: Click[] = []
  for (const entrance of ordered(motion.entrances)) {
    const preset = ENTRANCES[entrance.effect]
    if (!preset) {
      notices.push(
        `${entrance.selector}: unknown entrance ${entrance.effect}. Use ${list(Object.keys(ENTRANCES))}`,
      )
      continue
    }
    const spids = entrance.shapes.flatMap((name) => {
      const id = ids.get(name)
      return id ? [id] : []
    })
    if (spids.length === 0) {
      notices.push(
        `${entrance.selector}: draws no shape, so its entrance has nothing to animate`,
      )
      continue
    }
    const duration = millisecondsOf(entrance.duration) ?? DEFAULT_ENTRANCE_MS
    clicks.push({ preset, duration, spids })
  }

  const timing = clicks.length > 0 ? timingXml(clicks) : ''
  if (!transition && !timing) return { xml, notices }
  if (!xml.includes(ANCHOR)) {
    return {
      xml,
      notices: [
        ...notices,
        `no ${ANCHOR} to anchor motion after, so none was written`,
      ],
    }
  }
  return {
    xml: xml.replace(ANCHOR, `${ANCHOR}${transition}${timing}`),
    notices,
  }
}
