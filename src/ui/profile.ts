import { LEVEL_RATING, type GameRecord, type Profile, type RankedLevel } from '../platform/store'
import { getLang, t } from './i18n'

const levelLabel = (key: RankedLevel | 'hotseat' | 'online'): string =>
  t(`level.${key}`)

export function renderRatings(container: HTMLElement, p: Profile): void {
  container.innerHTML = ''
  for (const level of ['facile', 'normal', 'difficile'] as RankedLevel[]) {
    const st = p.levels[level]
    const games = st.wins + st.losses + st.draws
    const row = document.createElement('div')
    row.className = 'rating-row'
    row.innerHTML = `
      <div class="rating-head">
        <span>${levelLabel(level)}</span>
        <strong>${st.rating}</strong>
      </div>
      <div class="rating-sub">${t('ratings.sub', {
        games: `${games} ${t(games > 1 ? 'stats.games' : 'stats.game')}`,
        w: `${st.wins}${t('stats.wins')}`,
        l: `${st.losses}${t('stats.losses')}`,
        d: st.draws ? ` ${st.draws}${t('stats.draws')}` : '',
        target: String(LEVEL_RATING[level]),
      })}</div>
      <canvas class="spark" width="220" height="34"></canvas>
    `
    container.appendChild(row)
    spark(row.querySelector('canvas')!, p.curve[level] ?? [])
  }
}

function spark(canvas: HTMLCanvasElement, values: number[]): void {
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (values.length < 2) {
    ctx.fillStyle = '#5a6069'
    ctx.font = '11px system-ui'
    ctx.fillText('pas assez de parties classées', 4, 21)
    return
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(1, max - min)
  ctx.strokeStyle = '#7ee787'
  ctx.lineWidth = 2
  ctx.beginPath()
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * (canvas.width - 8) + 4
    const y = canvas.height - 6 - ((v - min) / span) * (canvas.height - 12)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()
}

export function renderHistory(
  tbody: HTMLElement,
  records: GameRecord[],
  onSelect: (r: GameRecord) => void,
): void {
  tbody.innerHTML = ''
  for (const r of [...records].reverse()) {
    const tr = document.createElement('tr')
    tr.className = r.result === 'win' ? 'row-win' : r.result === 'loss' ? 'row-loss' : ''
    const date = new Date(r.ts).toLocaleString(getLang() === 'en' ? 'en-GB' : 'fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    const res =
      r.result === 'win' ? `<span class="badge win">${t('badge.win')}</span>`
      : r.result === 'loss' ? `<span class="badge loss">${t('badge.loss')}</span>`
      : `<span class="badge draw">${t('badge.draw')}</span>`
    const colorCell =
      r.color === 'black' ? `● ${t('name.black')}`
      : r.color === 'white' ? `○ ${t('name.white')}`
      : '—'
    tr.innerHTML = `
      <td>${date}</td>
      <td>${levelLabel(r.level as RankedLevel) ?? r.level}</td>
      <td>${colorCell}</td>
      <td>${res}</td>
      <td>${r.reason}</td>
      <td>${r.plies}</td>
      <td><button class="mini" data-id="${r.id}">${t('replay.open')}</button></td>
    `
    const btn = tr.querySelector<HTMLButtonElement>('button.mini')!
    btn.addEventListener('click', () => onSelect(r))
    tbody.appendChild(tr)
  }
  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">${t('history.empty')}</td></tr>`
  }
}
