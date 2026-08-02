import type { Context } from 'hono'
import * as DeptService from './departments.service.js'
import { ok, created, badRequest, notFound, serverError } from '../utils/response.js'
import { CreateDepartmentSchema, UpdateDepartmentSchema } from '../utils/validators.js'
import type { HonoVariables } from '../types/index.js'

// GET /api/departments
export const list = async (c: Context) => {
  try {
    const departments = await DeptService.listDepartments()
    return ok(c, departments)
  } catch (err: unknown) {
    return serverError(c)
  }
}

// GET /api/departments/:id
export const getOne = async (c: Context) => {
  try {
    const dept = await DeptService.getDepartmentById(c.req.param('id') || '')
    return ok(c, dept)
  } catch (err: unknown) {
    return notFound(c)
  }
}

// POST /api/departments
export const create = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const body = await c.req.json()
    const parsed = CreateDepartmentSchema.safeParse(body)
    if (!parsed.success) return badRequest(c, parsed.error.issues[0].message)

    const dept = await DeptService.createDepartment(parsed.data)
    return created(c, dept)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create department'
    return badRequest(c, message)
  }
}

// PATCH /api/departments/:id
export const update = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const body = await c.req.json()
    const parsed = UpdateDepartmentSchema.safeParse(body)
    if (!parsed.success) return badRequest(c, parsed.error.issues[0].message)

    const dept = await DeptService.updateDepartment(c.req.param('id') || '', parsed.data)
    return ok(c, dept)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update department'
    return badRequest(c, message)
  }
}

// DELETE /api/departments/:id
export const remove = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    await DeptService.deleteDepartment(c.req.param('id') || '')
    return ok(c, { message: 'Department deleted' })
  } catch (err: unknown) {
    return serverError(c)
  }
}
