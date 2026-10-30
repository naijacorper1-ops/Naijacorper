// Small helpers for turning API data into what the screens show.

export function timeAgo(date) {
  if (!date) return ''
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 45) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${Math.max(minutes, 1)}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const d = new Date(date)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

export function clockTime(date) {
  return new Date(date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function joinedLabel(date) {
  if (!date) return ''
  return `Joined ${new Date(date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
}

export function naira(amount) {
  if (amount === 0) return 'Free'
  return `₦${Number(amount).toLocaleString('en-NG')}`
}

export function handleOf(user) {
  return user?.username ? `@${user.username}` : ''
}

// "/profile/@ada" and "/profile/ada" both work.
export function cleanUsername(value) {
  return (value || '').replace(/^@/, '')
}

export const ROLE_LABELS = {
  PROSPECTIVE_CORPER: 'Prospective corper',
  SERVING_CORPER: 'Serving',
  EX_CORPER: 'Ex-corper',
  BUSINESS: 'Business',
  RECRUITER: 'Recruiter',
  ADMIN: 'Admin',
}

export function userTag(user) {
  if (!user) return ''
  const role = ROLE_LABELS[user.role]
  return [role, user.state].filter(Boolean).join(' · ')
}

export const JOURNEY_ROLES = ['PROSPECTIVE_CORPER', 'SERVING_CORPER', 'EX_CORPER']

export const ROLE_TO_STAGE_LABEL = {
  PROSPECTIVE_CORPER: 'Preparing for NYSC',
  SERVING_CORPER: 'Currently serving',
  EX_CORPER: 'Completed NYSC',
}

// The backend accepts exactly these names (FCT, not "Abuja").
export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
  'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
  'Yobe', 'Zamfara',
]

export const NYSC_STAGES = [
  { value: 'WAITING_MOBILIZATION', label: 'Waiting for mobilization' },
  { value: 'WAITING_CALLUP', label: 'Waiting for call-up' },
  { value: 'WAITING_DEPLOYMENT', label: 'Waiting for deployment' },
  { value: 'RECEIVED_CALLUP', label: 'Received call-up letter' },
  { value: 'PREPARING_CAMP', label: 'Preparing for camp' },
  { value: 'OTHER', label: 'Other' },
]

// The two journeys have different interest lists on the backend.
export const PROSPECTIVE_INTERESTS = [
  { value: 'NYSC_UPDATES', label: 'NYSC updates' },
  { value: 'ORIENTATION_CAMP', label: 'Orientation camp' },
  { value: 'RELOCATION', label: 'Relocation' },
  { value: 'ACCOMMODATION', label: 'Accommodation' },
  { value: 'JOBS', label: 'Jobs' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'TECHNOLOGY', label: 'Technology' },
  { value: 'NETWORKING', label: 'Networking' },
  { value: 'MAKING_FRIENDS', label: 'Making friends' },
  { value: 'NYSC_TIPS', label: 'NYSC tips' },
  { value: 'CAREER_OPPORTUNITIES', label: 'Career opportunities' },
]

export const SERVING_INTERESTS = [
  { value: 'COMMUNITY', label: 'Community' },
  { value: 'JOBS', label: 'Jobs' },
  { value: 'ACCOMMODATION', label: 'Accommodation' },
  { value: 'MARKETPLACE', label: 'Marketplace' },
  { value: 'EXPLORE', label: 'Explore' },
  { value: 'EVENTS', label: 'Events' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'PROFESSIONAL_NETWORKING', label: 'Professional networking' },
  { value: 'TECHNOLOGY', label: 'Technology' },
  { value: 'ENTREPRENEURSHIP', label: 'Entrepreneurship' },
  { value: 'CAREER_DEVELOPMENT', label: 'Career development' },
]

export const LISTING_CATEGORIES = [
  { value: 'PHONES', label: 'Phones' },
  { value: 'LAPTOPS', label: 'Laptops' },
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'FASHION', label: 'Fashion' },
  { value: 'BOOKS', label: 'Books' },
  { value: 'KITCHEN_ITEMS', label: 'Kitchen' },
  { value: 'VEHICLES', label: 'Vehicles' },
  { value: 'ACCOMMODATION', label: 'Accommodation' },
  { value: 'SERVICES', label: 'Services' },
]

export const EXPLORE_CATEGORIES = [
  { value: 'ACCOMMODATION', label: 'Accommodation' },
  { value: 'FOOD', label: 'Food' },
  { value: 'RESTAURANTS', label: 'Restaurants' },
  { value: 'MAMI_MARKET', label: 'Mami market' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'HOSPITALS', label: 'Hospitals' },
  { value: 'PHARMACIES', label: 'Pharmacies' },
  { value: 'ATMS', label: 'ATMs & banks' },
  { value: 'CYBERCAFES', label: 'Cybercafés' },
  { value: 'PRINTING_SERVICES', label: 'Printing' },
  { value: 'MARKETS', label: 'Markets' },
  { value: 'NYSC_LOCATIONS', label: 'NYSC locations' },
  { value: 'ORIENTATION_CAMPS', label: 'Orientation camps' },
  { value: 'SECRETARIATS', label: 'Secretariats' },
  { value: 'PPAS', label: 'PPAs' },
  { value: 'EVENTS', label: 'Events' },
  { value: 'OTHER', label: 'Other' },
]

export function labelOf(list, value) {
  return list.find(o => o.value === value)?.label || value
}
