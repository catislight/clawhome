import type { UploadAdapter, UploadTask } from './DragDropFile.types'

export class FileUploadManager {
  private adapter?: UploadAdapter
  private concurrency: number
  private running = 0
  private queue: UploadTask[] = []
  private inFlight = new Map<string, UploadTask>()

  constructor(adapter?: UploadAdapter, concurrency = 3) {
    this.adapter = adapter
    this.concurrency = concurrency
  }

  setAdapter(adapter?: UploadAdapter): void {
    this.adapter = adapter
  }

  setConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, concurrency)
    this.pump()
  }

  enqueue(task: UploadTask): void {
    this.queue.push(task)
    task.onStatus?.('queued')
    this.pump()
  }

  cancel(id: string): void {
    const queuedIndex = this.queue.findIndex((task) => task.id === id)
    if (queuedIndex >= 0) {
      const [task] = this.queue.splice(queuedIndex, 1)
      task.onStatus?.('canceled')
      task.onError?.(new Error('Upload canceled'))
      return
    }

    const runningTask = this.inFlight.get(id)
    if (runningTask) {
      this.adapter?.cancel?.(id)
      runningTask.onStatus?.('canceled')
      runningTask.onError?.(new Error('Upload canceled'))
      this.inFlight.delete(id)
      this.running = Math.max(0, this.running - 1)
      this.pump()
    }
  }

  clearQueue(): void {
    this.queue = []
  }

  private pump(): void {
    if (!this.adapter) {
      return
    }

    while (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift()
      if (!task) {
        return
      }
      this.startTask(task)
    }
  }

  private startTask(task: UploadTask): void {
    if (!this.adapter) {
      task.onStatus?.('error')
      task.onError?.(new Error('Upload adapter is not configured'))
      return
    }

    this.running += 1
    this.inFlight.set(task.id, task)
    task.onStatus?.('uploading')

    this.adapter
      .upload(task.file, task.onProgress)
      .then((result) => {
        task.onStatus?.('success')
        task.onSuccess?.(result)
      })
      .catch((error) => {
        task.onStatus?.('error')
        task.onError?.(error)
      })
      .finally(() => {
        this.inFlight.delete(task.id)
        this.running = Math.max(0, this.running - 1)
        this.pump()
      })
  }
}
