import type { PlaceholderDefinition } from '../types.js'

export const PLACEHOLDER_REGISTRY: PlaceholderDefinition[] = [
  // Meeting placeholders
  { name: 'meeting.title', category: 'meeting', description: 'Title of the meeting', sample: 'Annual General Meeting' },
  { name: 'meeting.date', category: 'meeting', description: 'Date of the meeting', sample: '12th August 2026' },
  { name: 'meeting.time', category: 'meeting', description: 'Time of the meeting', sample: '09:00 AM - 11:00 AM' },
  { name: 'meeting.venue', category: 'meeting', description: 'Venue of the meeting', sample: 'Board Room' },
  { name: 'meeting.type', category: 'meeting', description: 'Type of meeting', sample: 'physical' },
  { name: 'meeting.reference', category: 'meeting', description: 'Meeting reference', sample: 'MTG-001' },
  { name: 'meeting.department', category: 'meeting', description: 'Department hosting the meeting', sample: 'ICT' },
  { name: 'meeting.organizer', category: 'meeting', description: 'Meeting organizer', sample: 'John Doe' },
  { name: 'meeting.description', category: 'meeting', description: 'Meeting description', sample: 'Discussion on annual budget' },
  
  // Organization placeholders
  { name: 'organization.name', category: 'organization', description: 'Organization name', sample: 'Kenya National Highways Authority' },
  { name: 'organization.short_name', category: 'organization', description: 'Organization short name', sample: 'KeNHA' },
  { name: 'organization.address', category: 'organization', description: 'Organization address', sample: 'Barabara Plaza' },
  { name: 'organization.phone', category: 'organization', description: 'Organization phone', sample: '020 - 4954000' },
  { name: 'organization.email', category: 'organization', description: 'Organization email', sample: 'dg@kenha.co.ke' },
  { name: 'organization.website', category: 'organization', description: 'Organization website', sample: 'www.kenha.co.ke' },
  { name: 'organization.vision', category: 'organization', description: 'Organization vision', sample: 'A quality National Trunk Road...' },
  { name: 'organization.mission', category: 'organization', description: 'Organization mission', sample: 'To develop and manage...' },
  { name: 'organization.core_values', category: 'organization', description: 'Organization core values', sample: 'Accountability...' },
  { name: 'organization.logo', category: 'organization', description: 'Organization logo image', sample: '{%organization.logo}' },

  // Document placeholders
  { name: 'document.number', category: 'document', description: 'Document tracking number', sample: 'DOC-2026-001' },
  { name: 'document.date', category: 'document', description: 'Date the document was generated', sample: '12/08/2026' },
  { name: 'document.generated_by', category: 'document', description: 'Person who generated the document', sample: 'Jane Doe' },

  // Participants placeholders (loop)
  { name: 'participants', category: 'participants', description: 'List of participants', sample: '{#participants}', isLoop: true },
  { name: 'sno', category: 'participants', description: 'Serial number', sample: '1' },
  { name: 'name', category: 'participants', description: 'Participant name', sample: 'John Smith' },
  { name: 'designation', category: 'participants', description: 'Participant designation', sample: 'Manager' },
  { name: 'organization', category: 'participants', description: 'Participant organization', sample: 'KeNHA' },
  { name: 'department', category: 'participants', description: 'Participant department', sample: 'ICT' },
  { name: 'signature', category: 'participants', description: 'Participant signature image', sample: '{%signature}' },
  { name: 'status', category: 'participants', description: 'Participant status', sample: 'Present' },
  { name: 'type', category: 'participants', description: 'Participant type', sample: 'staff' },
]

export function getPlaceholdersByCategory(category: string): PlaceholderDefinition[] {
  return PLACEHOLDER_REGISTRY.filter(p => p.category === category)
}

export function isValidPlaceholder(name: string): boolean {
  if (name === 'participants' || name === '/participants') return true
  // Allow % for images
  const cleanName = name.replace(/^[#/%]+/, '')
  return PLACEHOLDER_REGISTRY.some(p => p.name === cleanName)
}

export function getAllPlaceholderNames(): string[] {
  return PLACEHOLDER_REGISTRY.map(p => p.name)
}
