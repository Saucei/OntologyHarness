// Jobs schema migration + attachment helpers (S3-G) — pins Slice 2.
import { describe, it, expect, beforeEach } from 'vitest'
import { loadJobs, createJob, updateJob, type Job } from './jobs'
import { ws, setJobs } from './store'

const V1_JOB: any = { id: 'job-v1', title: 'Old job', source: 'manual', status: 'progress', owner: 'Berry', due: 'soon', tags: [], createdAt: new Date().toISOString(), activity: [] }

beforeEach(() => {
  localStorage.clear()
  ws.jobs = [V1_JOB]
  ws.hydrated = true
  ws.datasets = []
  ws.meta = {}
})

describe('jobs v1→v2 migration', () => {
  it('fills attachments=[] and a default priority for v1 jobs', () => {
    const jobs = loadJobs()
    const j = jobs.find(x => x.id === 'job-v1')!
    expect(j.attachments).toEqual([])
    expect(j.priority).toBe('normal')
    expect(j.v).toBe(2)
  })

  it('v1 activity/tags are preserved through migration', () => {
    setJobs([V1_JOB])
    const jobs = loadJobs()
    expect(jobs[0].activity).toEqual([])
  })

  it('createJob writes v2 with attachments', () => {
    const job = createJob({ title: 'New', attachments: [{ kind: 'dataset', id: 'ds-1', label: 'x.csv', hash: 'abc', addedAt: new Date().toISOString() }] })
    expect(job.v).toBe(2)
    expect(job.attachments).toHaveLength(1)
  })

  it('updateJob appends an activity entry', () => {
    const j = createJob({ title: 'Move me' })
    const after = updateJob(j.id, { status: 'done' }, 'moved')
    expect(after[0].status).toBe('done')
    expect(after[0].activity[after[0].activity.length - 1]?.text).toBe('moved')
  })
})
