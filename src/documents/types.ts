export interface DocumentData {
  organization: {
    name: string
    short_name: string | null
    logo: string | null  // base64 data URL
    address: string | null
    phone: string | null
    email: string | null
    website: string | null
    vision: string | null
    mission: string | null
    core_values: string | null
  }
  meeting: {
    title: string
    date: string
    time: string
    venue: string | null
    type: string
    reference: string
    department: string | null
    organizer: string
    description: string | null
  }
  participants: {
    sno: number
    name: string
    designation: string
    organization: string | null
    department: string | null
    signature: string  // base64
    status: string
    type: 'staff' | 'visitor'
  }[]
  document: {
    number: string
    date: string
    generated_by: string
  }
}

export interface PlaceholderDefinition {
  name: string
  category: string
  description: string
  sample: string
  isLoop?: boolean
}

export interface RenderOptions {
  templateId?: string
  meetingId: string
  format: 'pdf' | 'docx'
  version?: number
  documentNumber?: string
  userId: string
}
