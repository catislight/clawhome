import {
  deleteLocalMemoryFile as requestDeleteLocalMemoryFile,
  listLocalMemoryFiles as requestLocalMemoryFiles,
  readLocalMemoryFile as requestLocalMemoryFile,
  writeLocalMemoryFile as requestWriteLocalMemoryFile
} from '@/shared/api/app-api'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

function toLocalMemoryErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export async function listLocalMemoryFiles(workspacePath: string): Promise<string[]> {
  try {
    const response = await requestLocalMemoryFiles({
      workspacePath
    })
    if (!response.success) {
      throw new Error(response.message || translateWithAppLanguage('agents.error.localMemory.listFailed'))
    }
    return response.files
  } catch (error) {
    throw new Error(
      toLocalMemoryErrorMessage(error, translateWithAppLanguage('agents.error.localMemory.listFailed'))
    )
  }
}

export async function readLocalMemoryFile(params: {
  workspacePath: string
  relativeFilePath: string
}): Promise<{ found: boolean; content: string }> {
  try {
    const response = await requestLocalMemoryFile({
      workspacePath: params.workspacePath,
      relativeFilePath: params.relativeFilePath
    })
    if (!response.success) {
      throw new Error(response.message || translateWithAppLanguage('agents.error.localMemory.readFailed'))
    }
    return {
      found: response.found,
      content: response.content
    }
  } catch (error) {
    throw new Error(
      toLocalMemoryErrorMessage(error, translateWithAppLanguage('agents.error.localMemory.readFailed'))
    )
  }
}

export async function writeLocalMemoryFile(params: {
  workspacePath: string
  relativeFilePath: string
  content: string
}): Promise<void> {
  try {
    const response = await requestWriteLocalMemoryFile({
      workspacePath: params.workspacePath,
      relativeFilePath: params.relativeFilePath,
      content: params.content
    })
    if (!response.success) {
      throw new Error(response.message || translateWithAppLanguage('agents.error.localMemory.writeFailed'))
    }
  } catch (error) {
    throw new Error(
      toLocalMemoryErrorMessage(error, translateWithAppLanguage('agents.error.localMemory.writeFailed'))
    )
  }
}

export async function deleteLocalMemoryFile(params: {
  workspacePath: string
  relativeFilePath: string
}): Promise<boolean> {
  try {
    const response = await requestDeleteLocalMemoryFile({
      workspacePath: params.workspacePath,
      relativeFilePath: params.relativeFilePath
    })
    if (!response.success) {
      throw new Error(response.message || translateWithAppLanguage('agents.error.localMemory.deleteFailed'))
    }
    return response.deleted
  } catch (error) {
    throw new Error(
      toLocalMemoryErrorMessage(error, translateWithAppLanguage('agents.error.localMemory.deleteFailed'))
    )
  }
}
