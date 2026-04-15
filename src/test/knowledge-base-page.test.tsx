import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import KnowledgeBasePage from '../renderer/src/features/knowledge-base/pages/knowledge-base-page'
import {
  createInitialKnowledgeBaseStoreState,
  useKnowledgeBaseStore
} from '../renderer/src/features/knowledge-base/store/use-knowledge-base-store'

describe('KnowledgeBasePage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useKnowledgeBaseStore.setState(createInitialKnowledgeBaseStoreState())
    vi.restoreAllMocks()
  })

  it('renders empty favorites and templates state', () => {
    render(<KnowledgeBasePage />)

    expect(screen.getByText('暂无收藏内容')).toBeInTheDocument()
    expect(screen.getByText('在对话中心点击“收藏回复”后，会出现在这里。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '提示词模板' }))
    expect(screen.getByText('暂无提示词模板')).toBeInTheDocument()
  })

  it('creates, edits and deletes prompt templates', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<KnowledgeBasePage />)

    fireEvent.click(screen.getByRole('button', { name: '提示词模板' }))
    fireEvent.click(screen.getByRole('button', { name: '新增模板' }))

    fireEvent.change(screen.getByPlaceholderText('例如：需求分析助手'), {
      target: { value: '日报模板' }
    })
    fireEvent.change(screen.getByPlaceholderText('输入你常用的提示词模板…'), {
      target: { value: '请基于今天的任务输出一份日报。' }
    })
    fireEvent.change(screen.getByPlaceholderText('多个标签用逗号分隔，例如：写作, 总结'), {
      target: { value: '写作, 日报' }
    })

    fireEvent.click(screen.getByRole('button', { name: '保存模板' }))

    expect(screen.getByText('日报模板')).toBeInTheDocument()
    expect(screen.getByText('请基于今天的任务输出一份日报。')).toBeInTheDocument()
    expect(screen.getByText('写作')).toBeInTheDocument()
    expect(screen.getByText('日报')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '编辑模板' }))
    fireEvent.change(screen.getByPlaceholderText('例如：需求分析助手'), {
      target: { value: '周报模板' }
    })
    fireEvent.click(screen.getByRole('button', { name: '更新模板' }))

    expect(screen.getByText('周报模板')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '删除模板' }))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByText('暂无提示词模板')).toBeInTheDocument()
  })

  it('shows favorited content and supports removing item', () => {
    useKnowledgeBaseStore.getState().addFavorite({
      content: '这是一条已收藏的 AI 回复',
      sourceTimeLabel: '10:18'
    })

    render(<KnowledgeBasePage />)

    expect(screen.getByText('这是一条已收藏的 AI 回复')).toBeInTheDocument()
    expect(screen.getByText('来源时间 10:18')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '删除收藏内容' }))

    expect(screen.getByText('暂无收藏内容')).toBeInTheDocument()
  })
})
