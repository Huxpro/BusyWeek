/**
 * Date helpers ported from the original BusyWeek `util.js`.
 *
 * BusyWeek is a *time-based* todo list: the heavy lifting is converting between
 * a concrete date, the weekday, and the "how many days from today" offset.
 */

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const DAY_TYPES = ['今天', '明天', '后天', '大后天', '第五天', '第六天', '第七天', '下周今天']

/** Format a Date as `yyyy-mm-dd`. */
export function getDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  const mm = m < 10 ? `0${m}` : `${m}`
  const dd = d < 10 ? `0${d}` : `${d}`
  return `${y}-${mm}-${dd}`
}

/** Today as a `yyyy-mm-dd` string. */
export function getTodayDate(): string {
  return getDateStr(new Date())
}

/** Whole-day difference `startDate - endDate` (both `yyyy-mm-dd`). */
export function getDateDiff(startDate: string, endDate: string): number {
  const a = startDate.split('-')
  const b = endDate.split('-')
  const oDate1 = new Date(`${a[0]}-${a[1]}-${a[2]}`)
  const oDate2 = new Date(`${b[0]}-${b[1]}-${b[2]}`)
  return Math.trunc((oDate1.getTime() - oDate2.getTime()) / 1000 / 60 / 60 / 24)
}

/** The `yyyy-mm-dd` string for `dayType` days from today. */
export function getDiffDate(dayType: number): string {
  const time = new Date().getTime() + dayType * 24000 * 3600
  const date = new Date()
  date.setTime(time)
  return getDateStr(date)
}

/** Weekday label (周日…周六) for a `yyyy-mm-dd` string. */
export function getDay(dateStr: string): string {
  return WEEKDAYS[new Date(dateStr).getDay()]
}

/**
 * Human label for a date relative to today: 今天 / 明天 / … or "N 天后" / "N 天前".
 * Mirrors the original `getDayType` filter.
 */
export function getDayType(dateStr: string): string {
  const diff = getDateDiff(dateStr, getTodayDate())
  if (DAY_TYPES[diff]) {
    return DAY_TYPES[diff]
  }
  return diff > 0 ? `${diff}天后` : `${-diff}天前`
}

/** Short label for the day-picker option of a given relative offset. */
export function getPickerLabel(dayType: number): string {
  const base = DAY_TYPES[dayType] ?? `${dayType}天后`
  return `${base} ${getDay(getDiffDate(dayType))}`
}

export { DAY_TYPES }
