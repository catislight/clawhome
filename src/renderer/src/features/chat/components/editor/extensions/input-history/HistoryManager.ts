export class HistoryManager {
  private history: string[] = []
  private index: number = -1
  private maxLimit: number

  constructor(maxLimit: number = 50) {
    this.maxLimit = maxLimit
  }

  // 保存记录
  push(text: string): void {
    const cleanText = text.trim()
    if (!cleanText) return

    // 避免重复记录同一条
    if (this.history[this.history.length - 1] === cleanText) {
      this.index = -1 // 重置索引
      return
    }

    this.history.push(cleanText)
    if (this.history.length > this.maxLimit) {
      this.history.shift()
    }
    this.index = -1 // 每次输入新内容，重置翻阅索引
  }

  // 向上翻阅 (历史更久远)
  getPrevious(): string | null {
    if (this.history.length === 0) return null

    if (this.index === -1) {
      this.index = this.history.length - 1
    } else if (this.index > 0) {
      this.index--
    }
    return this.history[this.index]
  }

  // 向下翻阅 (历史更新)
  getNext(): string | null {
    if (this.index === -1 || this.index >= this.history.length - 1) {
      this.index = -1
      return '' // 返回空字符串表示回到初始输入
    }
    this.index++
    return this.history[this.index]
  }

  resetIndex(): void {
    this.index = -1
  }
}
