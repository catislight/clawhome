import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Select } from '../renderer/src/shared/ui/select'

describe('Select', () => {
  it('renders a custom listbox and selects the clicked option', () => {
    const onValueChange = vi.fn()

    render(
      <Select
        ariaLabel="实例选择"
        label="实例"
        options={[
          { value: 'a', label: '腾讯云' },
          { value: 'b', label: '阿里云' }
        ]}
        value="a"
        onValueChange={onValueChange}
      />
    )

    fireEvent.click(screen.getByRole('combobox', { name: '实例选择' }))

    expect(screen.getByRole('listbox', { name: '实例选择' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('option', { name: '阿里云' }))

    expect(onValueChange).toHaveBeenCalledWith('b')
  })
})
