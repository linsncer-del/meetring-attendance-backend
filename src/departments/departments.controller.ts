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

    // 1. Array of departments: [{ name, department_code, ... }]
    if (Array.isArray(body)) {
      const items: any[] = []
      for (const item of body) {
        const parsed = CreateDepartmentSchema.safeParse(item)
        if (parsed.success) {
          items.push(parsed.data)
        }
      }
      if (items.length === 0) return badRequest(c, 'Invalid department list provided')
      const createdDepts = await DeptService.createMultipleDepartments(items)
      return created(c, createdDepts)
    }

    // 2. Object with departments array: { departments: [...] }
    if (body && Array.isArray(body.departments)) {
      const items: any[] = []
      for (const item of body.departments) {
        const parsed = CreateDepartmentSchema.safeParse(item)
        if (parsed.success) {
          items.push(parsed.data)
        }
      }
      if (items.length === 0) return badRequest(c, 'Invalid department list provided')
      const createdDepts = await DeptService.createMultipleDepartments(items)
      return created(c, createdDepts)
    }

    // 3. Single department
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
