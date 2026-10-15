import { lazy, Suspense } from 'react'
import type { StorageTankProps } from './StorageTank'
const StorageTank = lazy(() => import('./StorageTank'))
export function LazyStorageTank(props: StorageTankProps) {
  return (
    <Suspense
      fallback={<div aria-hidden="true" style={{ minHeight: props.size === 'sm' ? 280 : 300 }} />}
    >
      <StorageTank {...props} />
    </Suspense>
  )
}
