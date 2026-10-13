import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from './api'
import { isMarkdownFile } from './markdown'
import { keys } from './queries'
import { useUI } from './ui'

/** Creates one document per dropped/selected Markdown file. Opens it when only one was imported. */
export function useImportFiles() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { toast } = useUI()
  const [busy, setBusy] = useState(false)

  const importFiles = async (fileList: FileList | File[], projectId: string | null) => {
    const files = [...fileList].filter(isMarkdownFile)
    if (!files.length) return toast('Only .md, .markdown or .txt files can be imported')
    setBusy(true)
    try {
      const created = []
      for (const file of files) {
        created.push(await api.docs.create({ content: await file.text(), projectId }))
      }
      await queryClient.invalidateQueries({ queryKey: keys.docs })
      if (created.length === 1) navigate(`/d/${created[0]!.id}`)
      else toast(`Imported ${created.length} documents`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return { importFiles, busy }
}
