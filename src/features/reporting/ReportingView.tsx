import { useEffect, useMemo, useState } from 'react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Badge from '../../components/ui/Badge'
import type { Task } from '../../types/task'
import type { TaskComment } from '../../types/comment'
import type { OKR } from '../../types/okr'
import { loadDb, persistDb } from '../../lib/storage/dbManager'
import { listTasks } from '../../lib/kanban/taskRepository'
import { listOkrs } from '../../lib/okr/okrRepository'
import { listComments } from '../../lib/oneonone/feedRepository'

type Filters = {
  start?: string
  end?: string
  project: string
  okr: string
  grouping: 'project' | 'sprint'
}

const hoursFromTask = (task: Task) => {
  if (!task.timeValue) return 0
  if (task.timeUnit === 'd') return task.timeValue * 8
  return task.timeValue
}

const progresOfOkr = (okr: OKR) => {
  if (!okr.keyResults?.length) return 0
  const ratios = okr.keyResults.map((kr) =>
    kr.target ? Math.min(1, kr.current / kr.target) : 0,
  )
  return (ratios.reduce((s, n) => s + n, 0) / ratios.length) * 100
}

const ReportingView = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [comments, setComments] = useState<TaskComment[]>([])
  const [okrs, setOkrs] = useState<OKR[]>([])
  const [filters, setFilters] = useState<Filters>({
    project: '',
    okr: '',
    grouping: 'project',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const ctx = await loadDb()
        setTasks(listTasks(ctx.db))
        setComments(listComments(ctx.db))
        setOkrs(listOkrs(ctx.db))
        await persistDb(ctx)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reporting data.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const filteredTasks = useMemo(() => {
    const start = filters.start ? Date.parse(filters.start) : undefined
    const end = filters.end ? Date.parse(filters.end) : undefined
    return tasks.filter((t) => {
      if (start && t.updatedAt < start) return false
      if (end && t.updatedAt > end) return false
      if (filters.project && t.project !== filters.project) return false
      if (filters.okr && t.okrLink !== filters.okr) return false
      return true
    })
  }, [tasks, filters])

  const summary = useMemo(() => {
    const doneCount = filteredTasks.filter((t) => t.lane === 'Done').length
    const totalHours = filteredTasks.reduce((sum, t) => sum + hoursFromTask(t), 0)
    const totalImpact =
      filteredTasks.reduce((sum, t) => sum + (t.impactPercent ?? 0), 0) /
      (filteredTasks.length || 1)
    const okrCompletion =
      okrs.length === 0
        ? 0
        : okrs.reduce((sum, o) => sum + progresOfOkr(o), 0) / okrs.length
    return { doneCount, totalHours, totalImpact: Number(totalImpact.toFixed(1)), okrCompletion: Number(okrCompletion.toFixed(1)) }
  }, [filteredTasks, okrs])

  const grouped = useMemo(() => {
    const groups: Record<string, Task[]> = {}
    filteredTasks.forEach((task) => {
      const key = filters.grouping === 'project' ? task.project || 'No epic' : task.sprint || 'No sprint'
      if (!groups[key]) groups[key] = []
      groups[key].push(task)
    })
    return groups
  }, [filteredTasks, filters.grouping])

  const managerFeedback = (taskId: string) =>
    comments
      .filter((c) => c.taskId === taskId && c.author === 'Manager')
      .sort((a, b) => b.createdAt - a.createdAt)[0]?.content

  const distinctProjects = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.project).filter(Boolean))) as string[],
    [tasks],
  )

  const exportMarkdown = () => {
    const lines: string[] = []
    lines.push('# Year-End Summary')
    lines.push(
      `- Total Hours: ${summary.totalHours.toFixed(1)}h`,
      `- Average Impact: ${summary.totalImpact}%`,
      `- Stories Done: ${summary.doneCount}`,
      `- OKR Completion: ${summary.okrCompletion}%`,
      '',
    )
    Object.entries(grouped).forEach(([group, groupTasks]) => {
      lines.push(`## ${filters.grouping === 'project' ? 'Epic' : 'Sprint'}: ${group}`)
      groupTasks.forEach((task) => {
        const mgr = managerFeedback(task.id)
        lines.push(`- ${task.title} (${task.id})`)
        lines.push(
          `  - Dates: ${task.startDate ? new Date(task.startDate).toLocaleDateString() : 'N/A'} → ${
            task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'
          }`,
        )
        if (task.okrLink) {
          const okr = okrs.find((o) => o.id === task.okrLink)
          lines.push(`  - OKR: ${okr ? okr.objective : task.okrLink}`)
        }
        lines.push(
          `  - Impact: ${task.impactPercent ?? 0}% | Sprint: ${task.sprint || 'N/A'} | Complexity: ${
            task.complexity || 'N/A'
          }`,
        )
        if (mgr) lines.push(`  - Manager feedback: ${mgr}`)
      })
      lines.push('')
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'year-end-report.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <Card className="p-6 text-text-secondary">Loading reporting…</Card>
  if (error)
    return (
      <Card className="p-6 text-red-200 border border-red-400/60 bg-red-500/10">
        {error}
      </Card>
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="date"
          value={filters.start ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, start: e.target.value }))}
        />
        <Input
          type="date"
          value={filters.end ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, end: e.target.value }))}
        />
        <Select
          value={filters.project}
          onChange={(e) => setFilters((f) => ({ ...f, project: e.target.value }))}
          className="max-w-[200px]"
        >
          <option value="">All epics</option>
          {distinctProjects.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Select>
        <Select
          value={filters.okr}
          onChange={(e) => setFilters((f) => ({ ...f, okr: e.target.value }))}
          className="max-w-[220px]"
        >
          <option value="">All OKRs</option>
          {okrs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.objective}
            </option>
          ))}
        </Select>
        <Select
          value={filters.grouping}
          onChange={(e) =>
            setFilters((f) => ({ ...f, grouping: e.target.value as Filters['grouping'] }))
          }
          className="max-w-[200px]"
        >
          <option value="project">Group by epic</option>
          <option value="sprint">Group by sprint</option>
        </Select>
        <Button variant="ghost" onClick={exportMarkdown}>
          Export Markdown
        </Button>
        <Button variant="ghost" onClick={() => window.print()}>
          Print to PDF
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-text-secondary">Total Hours</p>
          <p className="text-2xl font-semibold text-text-primary">
            {summary.totalHours.toFixed(1)}h
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-text-secondary">Avg Impact</p>
          <p className="text-2xl font-semibold text-text-primary">{summary.totalImpact}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-text-secondary">Done</p>
          <p className="text-2xl font-semibold text-text-primary">{summary.doneCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-text-secondary">OKR completion</p>
          <p className="text-2xl font-semibold text-text-primary">{summary.okrCompletion}%</p>
        </Card>
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([group, groupTasks]) => (
          <Card key={group} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-text-secondary">
                  {filters.grouping === 'project' ? 'Epic' : 'Sprint'}
                </p>
                <h3 className="text-xl font-semibold text-text-primary">{group}</h3>
              </div>
              <Badge>{groupTasks.length} items</Badge>
            </div>
            <div className="space-y-3">
              {groupTasks.map((task) => {
                const mgr = managerFeedback(task.id)
                const okr = okrs.find((o) => o.id === task.okrLink)
                return (
                  <Card key={task.id} className="p-3 bg-background">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-text-primary">{task.title}</p>
                      {okr ? <Badge>{okr.objective}</Badge> : null}
                    </div>
                    <p className="text-xs text-text-secondary">
                      {task.startDate ? new Date(task.startDate).toLocaleDateString() : 'N/A'} →{' '}
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'} | Sprint:{' '}
                      {task.sprint || 'N/A'} | Impact {task.impactPercent ?? 0}%
                    </p>
                    {mgr ? (
                      <p className="text-sm text-text-secondary mt-2">Manager: {mgr}</p>
                    ) : null}
                  </Card>
                )
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default ReportingView
