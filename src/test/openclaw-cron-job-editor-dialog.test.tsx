import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import OpenClawCronJobEditorDialog from '../renderer/src/features/cron/components/openclaw-cron-job-editor-dialog'

describe('OpenClawCronJobEditorDialog', () => {
  it('keeps the cron editor focused on active controls and compact scheduling fields', () => {
    render(
      <OpenClawCronJobEditorDialog
        error={null}
        mode="create"
        open
        submitting={false}
        onClose={vi.fn()}
        onSubmit={vi.fn(async () => {})}
      />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '新建定时任务' })).toBeInTheDocument()
    expect(screen.queryByText('说明')).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: '启用任务' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '选择调度方式' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '选择完成后通知' })).toBeInTheDocument()
    expect(screen.getByLabelText('通知渠道')).toBeInTheDocument()
    expect(screen.getByText('通知渠道').compareDocumentPosition(screen.getByText('执行位置'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })
})
