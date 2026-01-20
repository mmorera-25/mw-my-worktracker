import { useCallback, useEffect, useRef } from 'react'
import Quill from 'quill'
import clsx from 'clsx'

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

const toolbarOptions = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
  ['link', 'code-block'],
  ['clean'],
]

const RichTextEditor = ({ value, onChange, placeholder, className }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const quillRef = useRef<Quill | null>(null)
  const toolbarRef = useRef<HTMLElement | null>(null)

  const removeToolbar = useCallback(() => {
    const toolbar =
      toolbarRef.current ||
      (containerRef.current?.previousElementSibling instanceof HTMLElement
        ? containerRef.current.previousElementSibling
        : null)

    if (toolbar?.classList.contains('ql-toolbar')) {
      toolbar.remove()
    }

    toolbarRef.current = null
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    // Avoid creating multiple toolbars/editors under StrictMode
    if (quillRef.current) return

    removeToolbar()
    containerRef.current.innerHTML = ''
    const quill = new Quill(containerRef.current, {
      theme: 'snow',
      modules: { toolbar: toolbarOptions },
      placeholder,
    })
    const toolbar = containerRef.current.previousElementSibling
    toolbarRef.current =
      toolbar instanceof HTMLElement && toolbar.classList.contains('ql-toolbar')
        ? toolbar
        : null
    const handler = () => onChange(quill.root.innerHTML)
    quill.on('text-change', handler)
    quill.root.innerHTML = value || ''
    quillRef.current = quill

    return () => {
      quill.off('text-change', handler)
      quillRef.current = null
      removeToolbar()
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [])

  useEffect(() => {
    const quill = quillRef.current
    if (!quill) return
    const current = quill.root.innerHTML
    if (value !== current) {
      quill.root.innerHTML = value || ''
    }
  }, [value])

  return (
    <div
      className={clsx(
        'rich-editor rounded-xl border border-border bg-background text-text-primary',
        className,
      )}
    >
      <div ref={containerRef} />
    </div>
  )
}

export default RichTextEditor
