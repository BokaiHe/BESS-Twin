// The guided tour opens by itself once per browser storage profile. When storage is
// unavailable, the module flag still prevents a second automatic start in this page.
// Renamed from 'bess-twin-tour-hint-seen' so visitors who only saw the old hint get the tour once.
const SEEN_KEY = 'bess-twin-tour-seen'
let claimed = false

/** Returns true exactly once for a visitor who has not seen the tour yet. */
export function claimFirstVisitTour() {
  if (claimed) return false
  claimed = true
  try {
    if (localStorage.getItem(SEEN_KEY) === '1') return false
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // Storage disabled: start the tour, but it may reappear on the next visit.
  }
  return true
}
