// Builds seed reports off the main thread. Load with
// `new Worker(new URL('./report.worker.ts', import.meta.url), { type: 'module' })`.
import {
  answerReportRequest,
  type ReportWorkerRequest,
} from './report-protocol'
import { seedReport } from './wasm'

self.addEventListener('message', (event: MessageEvent<ReportWorkerRequest>) => {
  if (event.data?.type !== 'seed-report') return
  void answerReportRequest(event.data, seedReport).then((response) =>
    self.postMessage(response)
  )
})
