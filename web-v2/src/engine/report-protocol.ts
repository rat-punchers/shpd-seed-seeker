// Messages between the app and the seed-report worker. The visual tests'
// fake worker (tooling/web-visual) speaks the same protocol.
import type { SeedReport, SeedReportRequest } from './types'

export interface ReportWorkerRequest {
  type: 'seed-report'
  id: number
  request: SeedReportRequest
}

export type ReportWorkerResponse =
  | { type: 'seed-report'; id: number; ok: true; report: SeedReport }
  | { type: 'seed-report'; id: number; ok: false; error: string }

/** Answers one request; engine errors become `ok: false` with their message. */
export async function answerReportRequest(
  message: ReportWorkerRequest,
  report: (request: SeedReportRequest) => Promise<SeedReport>
): Promise<ReportWorkerResponse> {
  try {
    return {
      type: 'seed-report',
      id: message.id,
      ok: true,
      report: await report(message.request),
    }
  } catch (error) {
    return {
      type: 'seed-report',
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
