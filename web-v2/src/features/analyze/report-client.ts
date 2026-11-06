// Seed reports from the report worker (src/engine/report.worker.ts). One
// worker serves every request, matched by id, so the engine module loads once.
import type {
  ReportWorkerRequest,
  ReportWorkerResponse,
} from '../../engine/report-protocol'
import type { SeedReport, SeedReportRequest } from '../../engine/types'

/** A request in flight. `cancel` rejects it and drops the answer. */
export interface ReportTask {
  promise: Promise<SeedReport>
  cancel: () => void
}

export type ReportClient = (request: SeedReportRequest) => ReportTask

/** The message a cancelled task rejects with. */
export const CANCELLED = 'Cancelled'

interface Pending {
  resolve: (report: SeedReport) => void
  reject: (error: Error) => void
}

let worker: Worker | undefined
let nextId = 0
const pending = new Map<number, Pending>()

function failAll(message: string) {
  for (const task of pending.values()) task.reject(new Error(message))
  pending.clear()
}

function getWorker(): Worker {
  if (worker) return worker
  const created = new Worker(
    new URL('../../engine/report.worker.ts', import.meta.url),
    { type: 'module' }
  )
  created.onmessage = (event: MessageEvent<ReportWorkerResponse>) => {
    const answer = event.data
    if (answer?.type !== 'seed-report') return
    const task = pending.get(answer.id)
    if (!task) return
    pending.delete(answer.id)
    if (answer.ok) task.resolve(answer.report)
    else task.reject(new Error(answer.error))
  }
  // A crashed worker cannot answer; the next request starts a new one.
  created.onerror = (event) => {
    event.preventDefault?.()
    created.terminate()
    if (worker === created) worker = undefined
    failAll(event.message || 'The report worker failed.')
  }
  worker = created
  return created
}

/** Asks the report worker for one seed's report. */
export const requestReport: ReportClient = (request) => {
  const id = ++nextId
  let reject: (error: Error) => void = () => {}
  const promise = new Promise<SeedReport>((resolve, rejectTask) => {
    reject = rejectTask
    pending.set(id, { resolve, reject: rejectTask })
  })
  getWorker().postMessage({
    type: 'seed-report',
    id,
    request,
  } satisfies ReportWorkerRequest)
  return {
    promise,
    cancel: () => {
      if (!pending.delete(id)) return
      reject(new Error(CANCELLED))
    },
  }
}
