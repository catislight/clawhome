import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import OpenClawCreateDialog from '../renderer/src/features/instances/components/openclaw-create-dialog'

describe('OpenClawCreateDialog', () => {
  it('uses a guided flow when adding an instance from instance management', () => {
    render(<OpenClawCreateDialog open onClose={vi.fn()} onSubmitSetup={vi.fn()} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '添加实例' })).toBeInTheDocument()
    expect(screen.getByLabelText('实例名称')).toBeInTheDocument()
    expect(screen.getByLabelText('实例描述（可选）')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下一步' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /远程连接/ }))
    fireEvent.change(screen.getByLabelText('实例名称'), { target: { value: '新实例' } })
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))

    expect(screen.getByLabelText('主机地址')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '完成并连接' })).toBeInTheDocument()
  })

  it('disables local connection option when one local instance already exists', () => {
    render(<OpenClawCreateDialog open hasLocalInstance onClose={vi.fn()} onSubmitSetup={vi.fn()} />)

    const localOption = screen.getByRole('button', { name: /本地连接/ })
    expect(localOption).toBeDisabled()
    expect(screen.getByText('已存在本地实例，本地连接仅允许一个。')).toBeInTheDocument()
  })
})
