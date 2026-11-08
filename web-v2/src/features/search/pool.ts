import type { SearchWorkerRequest, SearchWorkerResponse } from './protocol'

/** Scan workers, created on demand and kept for later searches. */
export class WorkerPool {
  private workers: Worker[] = []

  constructor(
    private readonly onMessage: (
      workerId: number,
      message: SearchWorkerResponse
    ) => void
  ) {}

  /** The first `count` workers, starting any that do not exist yet. */
  ensure(count: number): Worker[] {
    const target = Math.max(1, Math.floor(count) || 1)
    while (this.workers.length < target) {
      const workerId = this.workers.length
      const worker = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module',
      })
      worker.addEventListener(
        'message',
        (event: MessageEvent<SearchWorkerResponse>) =>
          this.onMessage(workerId, event.data)
      )
      this.workers.push(worker)
    }
    return this.workers.slice(0, target)
  }

  broadcast(message: SearchWorkerRequest): void {
    for (const worker of this.workers) worker.postMessage(message)
  }
}
