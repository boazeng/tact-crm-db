const TOKEN_KEY = 'tactcrm-token'
const COMPANY_KEY = 'tactcrm-active-company-id'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t)
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(COMPANY_KEY)
}

/** For super_admin: which tenant to view. Ignored for other roles. */
export function getActiveCompanyId(): number | null {
  const v = localStorage.getItem(COMPANY_KEY)
  return v ? Number(v) : null
}
export function setActiveCompanyId(id: number | null) {
  if (id === null) localStorage.removeItem(COMPANY_KEY)
  else localStorage.setItem(COMPANY_KEY, String(id))
}

type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined>
  auth?: boolean
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true } = opts
  const url = new URL(path, window.location.origin)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const t = getToken()
    if (t) headers['Authorization'] = `Bearer ${t}`
  }
  const res = await fetch(url.toString().replace(window.location.origin, ''), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return undefined as T
  if (!res.ok) {
    let detail: string
    try {
      const j = await res.json()
      detail = j.detail ? (typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)) : res.statusText
    } catch {
      detail = res.statusText
    }
    throw new ApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// ---------- Types ----------
export type UserRole = 'super_admin' | 'company_admin' | 'company_user'

export type CurrentUser = {
  id: number
  email: string
  full_name: string
  role: UserRole
  company_id: number | null
  company_name: string | null
}

export type DevUserOption = {
  id: number
  email: string
  full_name: string
  role: UserRole
  company_name: string | null
}

export type Company = {
  id: number
  name: string
  slug: string
  contact_email: string | null
  phone: string | null
  is_active: boolean
  created_at: string
}

export type UserRow = {
  id: number
  full_name: string
  email: string
  phone: string | null
  role: UserRole
  company_id: number | null
  is_active: boolean
  created_at: string
}

export type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect'

export type FieldDefinition = {
  id: number
  company_id: number
  key: string
  label: string
  field_type: FieldType
  options: string[] | null
  is_required: boolean
  sort_order: number
  is_active: boolean
  created_at: string
}

export type Customer = {
  membership_id: number
  company_id: number
  status: string
  source: string
  external_ref: string | null
  joined_at: string
  parent_membership_id: number | null
  parent_name: string | null
  is_paying: boolean
  paid_by_membership_id: number | null
  paid_by_name: string | null
  links: CustomerLink[]
  id: number
  customer_number: string | null
  full_name: string
  customer_type: string
  company_name: string | null
  national_id: string | null
  nickname: string | null
  role: string | null
  street1: string | null
  city1: string | null
  street2: string | null
  city2: string | null
  phone: string | null
  email: string | null
  allow_mailing: boolean
  notes: string | null
  creation_date: string | null
  params: (string | null)[]
  numbers: (number | null)[]
  flags: boolean[]
  lists: (string | null)[]
  created_at: string
  updated_at: string
  fields: Record<string, unknown>
}

export type CustomerLink = {
  linked_membership_id: number
  role: string | null
  name?: string | null
}

export type CustomerInput = {
  customer_number?: string | null
  full_name: string
  customer_type?: string
  company_name?: string | null
  national_id?: string | null
  nickname?: string | null
  role?: string | null
  street1?: string | null
  city1?: string | null
  street2?: string | null
  city2?: string | null
  phone?: string | null
  email?: string | null
  allow_mailing?: boolean
  notes?: string | null
  creation_date?: string | null
  params?: (string | null)[]
  numbers?: (number | null)[]
  flags?: boolean[]
  lists?: (string | null)[]
  status?: string
  source?: string
  external_ref?: string | null
  is_paying?: boolean
  paid_by_membership_id?: number | null
  links?: { linked_membership_id: number; role: string | null }[]
  fields?: Record<string, unknown>
}

export type ApiKeyRow = {
  id: number
  company_id: number
  label: string
  key_prefix: string
  is_active: boolean
  last_used_at: string | null
  created_at: string
}
export type ApiKeyCreated = ApiKeyRow & { raw_key: string }

export type DashboardResponse = {
  total_customers: number
  by_status: Record<string, number>
  total_fields: number
  breakdowns: { key: string; label: string; counts: Record<string, number> }[]
}

// ---------- Endpoints ----------
const cq = (companyId?: number) => ({ company_id: companyId })

export const Auth = {
  login: (email: string, password: string) =>
    api<{ access_token: string; user: CurrentUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),
  devUsers: () => api<DevUserOption[]>('/api/auth/dev-users', { auth: false }),
  devLogin: (email: string) =>
    api<{ access_token: string; user: CurrentUser }>('/api/auth/dev-login', {
      method: 'POST',
      body: { email },
      auth: false,
    }),
  me: () => api<CurrentUser>('/api/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<{ ok: boolean }>('/api/auth/change-password', {
      method: 'POST',
      body: { current_password: currentPassword, new_password: newPassword },
    }),
}

export const Dashboard = {
  fetch: (companyId?: number) =>
    api<DashboardResponse>('/api/dashboard', { query: cq(companyId) }),
}

export const Companies = {
  list: () => api<Company[]>('/api/admin/companies'),
  create: (body: Omit<Company, 'id' | 'created_at'>) =>
    api<Company>('/api/admin/companies', { method: 'POST', body }),
  update: (id: number, body: Omit<Company, 'id' | 'created_at'>) =>
    api<Company>(`/api/admin/companies/${id}`, { method: 'PUT', body }),
  remove: (id: number) => api<void>(`/api/admin/companies/${id}`, { method: 'DELETE' }),
}

export const Users = {
  list: (companyId?: number) =>
    api<UserRow[]>('/api/admin/users', { query: cq(companyId) }),
  create: (body: Partial<UserRow>) =>
    api<UserRow>('/api/admin/users', { method: 'POST', body }),
  update: (id: number, body: Partial<UserRow>) =>
    api<UserRow>(`/api/admin/users/${id}`, { method: 'PUT', body }),
  remove: (id: number) => api<void>(`/api/admin/users/${id}`, { method: 'DELETE' }),
}

export const Fields = {
  list: (companyId?: number) =>
    api<FieldDefinition[]>('/api/field-definitions', { query: cq(companyId) }),
  create: (body: Partial<FieldDefinition>, companyId?: number) =>
    api<FieldDefinition>('/api/field-definitions', { method: 'POST', body, query: cq(companyId) }),
  update: (id: number, body: Partial<FieldDefinition>, companyId?: number) =>
    api<FieldDefinition>(`/api/field-definitions/${id}`, { method: 'PUT', body, query: cq(companyId) }),
  remove: (id: number, companyId?: number) =>
    api<void>(`/api/field-definitions/${id}`, { method: 'DELETE', query: cq(companyId) }),
}

export type RoleOption = {
  id: number
  company_id: number
  label: string
  sort_order: number
  is_active: boolean
}

export const RoleOptions = {
  list: (companyId?: number) =>
    api<RoleOption[]>('/api/role-options', { query: cq(companyId) }),
  create: (body: { label: string; sort_order?: number }, companyId?: number) =>
    api<RoleOption>('/api/role-options', { method: 'POST', body, query: cq(companyId) }),
  update: (id: number, body: { label: string; sort_order?: number; is_active?: boolean }, companyId?: number) =>
    api<RoleOption>(`/api/role-options/${id}`, { method: 'PUT', body, query: cq(companyId) }),
  remove: (id: number, companyId?: number) =>
    api<void>(`/api/role-options/${id}`, { method: 'DELETE', query: cq(companyId) }),
}

export type ParamLabel = {
  param_index: number   // 1-based: 1 → param1 ... 15 → param15
  label: string
  is_active: boolean
}

export const ParamLabels = {
  list: (companyId?: number) =>
    api<ParamLabel[]>('/api/param-labels', { query: cq(companyId) }),
  update: (labels: ParamLabel[], companyId?: number) =>
    api<ParamLabel[]>('/api/param-labels', { method: 'PUT', body: { labels }, query: cq(companyId) }),
}

export type NumberLabel = {
  num_index: number     // 1-based: 1 → num1 ... 15 → num15
  label: string
  is_active: boolean
}

export const NumberLabels = {
  list: (companyId?: number) =>
    api<NumberLabel[]>('/api/number-labels', { query: cq(companyId) }),
  update: (labels: NumberLabel[], companyId?: number) =>
    api<NumberLabel[]>('/api/number-labels', { method: 'PUT', body: { labels }, query: cq(companyId) }),
}

export type FlagLabel = {
  flag_index: number   // 1-based: 1 → flag1 ... 5 → flag5
  label: string
  is_active: boolean
}

export const FlagLabels = {
  list: (companyId?: number) =>
    api<FlagLabel[]>('/api/flag-labels', { query: cq(companyId) }),
  update: (labels: FlagLabel[], companyId?: number) =>
    api<FlagLabel[]>('/api/flag-labels', { method: 'PUT', body: { labels }, query: cq(companyId) }),
}

export type ListFieldDef = {
  list_index: number   // 1-based: 1 → list1 ... 10 → list10
  label: string
  options: string[]
  is_active: boolean
}

export const ListFields = {
  list: (companyId?: number) =>
    api<ListFieldDef[]>('/api/list-fields', { query: cq(companyId) }),
  update: (labels: ListFieldDef[], companyId?: number) =>
    api<ListFieldDef[]>('/api/list-fields', { method: 'PUT', body: { labels }, query: cq(companyId) }),
}

export type ColumnKind = 'param' | 'flag' | 'list'
export type DisplayColumn = {
  kind: ColumnKind
  ref_index: number   // 1-based index within that kind
}

export const DisplayColumns = {
  list: (companyId?: number) =>
    api<DisplayColumn[]>('/api/display-columns', { query: cq(companyId) }),
  update: (columns: DisplayColumn[], companyId?: number) =>
    api<DisplayColumn[]>('/api/display-columns', { method: 'PUT', body: { columns }, query: cq(companyId) }),
}

// ---------- Projects ----------
export type Project = {
  id: number
  company_id: number
  project_number: string | null
  name: string
  description: string | null
  customer_membership_id: number | null
  customer_name: string | null
  notes: string | null
  creation_date: string | null
  params: (string | null)[]
  numbers: (number | null)[]
  flags: boolean[]
  lists: (string | null)[]
  created_at: string
  updated_at: string
}

export type ProjectInput = {
  project_number?: string | null
  name: string
  description?: string | null
  customer_membership_id?: number | null
  notes?: string | null
  creation_date?: string | null
  params?: (string | null)[]
  numbers?: (number | null)[]
  flags?: boolean[]
  lists?: (string | null)[]
}

export const Projects = {
  list: (companyId?: number, search?: string) =>
    api<Project[]>('/api/projects', { query: { company_id: companyId, search } }),
  get: (id: number, companyId?: number) =>
    api<Project>(`/api/projects/${id}`, { query: cq(companyId) }),
  create: (body: ProjectInput, companyId?: number) =>
    api<Project>('/api/projects', { method: 'POST', body, query: cq(companyId) }),
  update: (id: number, body: ProjectInput, companyId?: number) =>
    api<Project>(`/api/projects/${id}`, { method: 'PUT', body, query: cq(companyId) }),
  remove: (id: number, companyId?: number) =>
    api<void>(`/api/projects/${id}`, { method: 'DELETE', query: cq(companyId) }),
}

export type ProjectFieldKind = 'param' | 'number' | 'flag' | 'list'
export type ProjectFieldLabel = {
  kind: ProjectFieldKind
  idx: number
  label: string
  options: string[]
  is_active: boolean
  sort_order: number
}

export type ProjectFieldRef = { kind: ProjectFieldKind; idx: number }
// The label fields the editor sends; sort_order is owned by the reorder endpoint.
export type ProjectFieldLabelInput = Omit<ProjectFieldLabel, 'sort_order'>

export const ProjectFieldLabels = {
  list: (companyId?: number) =>
    api<ProjectFieldLabel[]>('/api/project-field-labels', { query: cq(companyId) }),
  update: (labels: ProjectFieldLabelInput[], companyId?: number) =>
    api<ProjectFieldLabel[]>('/api/project-field-labels', { method: 'PUT', body: { labels }, query: cq(companyId) }),
  reorder: (order: ProjectFieldRef[], companyId?: number) =>
    api<ProjectFieldLabel[]>('/api/project-field-labels/order', { method: 'PUT', body: { order }, query: cq(companyId) }),
}

export const Customers = {
  list: (
    companyId?: number,
    search?: string,
    opts?: { status?: string; excludeStatus?: string },
  ) =>
    api<Customer[]>('/api/customers', {
      query: {
        company_id: companyId,
        search,
        status: opts?.status,
        exclude_status: opts?.excludeStatus,
      },
    }),
  get: (membershipId: number, companyId?: number) =>
    api<Customer>(`/api/customers/${membershipId}`, { query: cq(companyId) }),
  create: (body: CustomerInput, companyId?: number) =>
    api<Customer>('/api/customers', { method: 'POST', body, query: cq(companyId) }),
  update: (membershipId: number, body: CustomerInput, companyId?: number) =>
    api<Customer>(`/api/customers/${membershipId}`, { method: 'PUT', body, query: cq(companyId) }),
  remove: (membershipId: number, companyId?: number) =>
    api<void>(`/api/customers/${membershipId}`, { method: 'DELETE', query: cq(companyId) }),
}

export const ApiKeys = {
  list: (companyId?: number) =>
    api<ApiKeyRow[]>('/api/api-keys', { query: cq(companyId) }),
  create: (label: string, companyId?: number) =>
    api<ApiKeyCreated>('/api/api-keys', { method: 'POST', body: { label }, query: cq(companyId) }),
  remove: (id: number, companyId?: number) =>
    api<void>(`/api/api-keys/${id}`, { method: 'DELETE', query: cq(companyId) }),
}

// ---------- Priority sync ----------
export type PriorityConnection = {
  base_url: string
  username: string | null
  entity_name: string
  is_active: boolean
  password_set: boolean
  last_tested_at: string | null
  last_test_ok: boolean | null
  last_test_msg: string | null
}

export type PriorityConnectionInput = {
  base_url: string
  username?: string | null
  password?: string | null   // empty → keep stored secret
  entity_name: string
  is_active?: boolean
}

/** A field discovered live from Priority (left side of the mapping). */
export type PriorityField = {
  name: string
  type: string
  label: string
  sample?: string
  description?: string   // Hebrew explanation of the Priority field
  suggested?: string     // recommended CRM target key, or '-' to skip
}

/** A CRM target field (right side of the mapping). */
export type SystemField = { key: string; label: string; group: string }

export type PriorityFieldMap = {
  priority_field: string
  priority_label: string | null
  priority_type: string | null
  target_field: string | null
  is_imported: boolean
  sort_order: number
}

export type IngestSummary = {
  total: number
  created: number
  updated: number
  skipped: number
  errors: { key: string | null; error: string }[]
}

export const PrioritySync = {
  getConnection: (companyId?: number) =>
    api<PriorityConnection | null>('/api/priority-sync/connection', { query: cq(companyId) }),
  saveConnection: (body: PriorityConnectionInput, companyId?: number) =>
    api<PriorityConnection>('/api/priority-sync/connection', { method: 'PUT', body, query: cq(companyId) }),
  testConnection: (companyId?: number) =>
    api<{ ok: boolean; message: string }>('/api/priority-sync/connection/test', {
      method: 'POST',
      query: cq(companyId),
    }),
  priorityFields: (companyId?: number) =>
    api<PriorityField[]>('/api/priority-sync/priority-fields', { query: cq(companyId) }),
  systemFields: (companyId?: number) =>
    api<SystemField[]>('/api/priority-sync/system-fields', { query: cq(companyId) }),
  mappings: (companyId?: number) =>
    api<PriorityFieldMap[]>('/api/priority-sync/mappings', { query: cq(companyId) }),
  saveMappings: (rows: PriorityFieldMap[], companyId?: number) =>
    api<PriorityFieldMap[]>('/api/priority-sync/mappings', { method: 'PUT', body: { rows }, query: cq(companyId) }),
  ingest: (limit: number | null, companyId?: number) =>
    api<IngestSummary>('/api/priority-sync/ingest', { method: 'POST', body: { limit }, query: cq(companyId) }),
}
