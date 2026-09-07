// Central mock data for the NaijaCorper frontend prototype.
// No backend — everything here is static seed data used across screens.

export const currentUser = {
  id: 'u_me',
  name: 'David Okafor',
  handle: '@david_codes',
  avatar: 'D',
  bio: 'Software developer serving in Lagos. Looking to connect with other tech corps members. Building small things that matter.',
  stage: 'serving', // preparing | serving | completed
  state: 'Lagos',
  lga: 'Yaba',
  batch: '2026 Batch B · Stream 1',
  ppa: 'Paystack (Fintech)',
  profession: 'Software Development',
  skills: ['React', 'Node.js', 'UI Design', 'Python'],
  lookingFor: ['Remote opportunities', 'Collaborations'],
  followers: 486,
  following: 312,
  joined: 'Joined March 2026',
}

export const users = {
  '@david_codes': currentUser,
  '@amara_serves': {
    id: 'u_amara', name: 'Amara N.', handle: '@amara_serves', avatar: 'A',
    bio: 'Ex-corper (Oyo). Iseyin camp survivor. Happy to answer NYSC questions 💚',
    stage: 'completed', state: 'Oyo', profession: 'Content & Marketing',
    skills: ['Copywriting', 'Community'], lookingFor: ['Mentoring'],
    followers: 3120, following: 210, joined: 'Joined Jan 2025',
  },
  '@nysctech': {
    id: 'u_tech', name: 'NYSC Tech Corps', handle: '@nysctech', avatar: 'N',
    bio: 'Community account for tech corps members across Nigeria.',
    stage: 'community', state: 'National', profession: 'Community',
    skills: [], lookingFor: [], followers: 12400, following: 12, joined: 'Joined 2024',
  },
  '@chidi_dev': {
    id: 'u_chidi', name: 'Chidi Eze', handle: '@chidi_dev', avatar: 'C',
    bio: 'Frontend dev · Tech · Lagos. React & TypeScript.',
    stage: 'serving', state: 'Lagos', profession: 'Software Development',
    skills: ['React', 'TypeScript'], lookingFor: ['Full-time roles'],
    followers: 640, following: 380, joined: 'Joined Feb 2026',
  },
  '@fatima_b': {
    id: 'u_fatima', name: 'Fatima B.', handle: '@fatima_b', avatar: 'F',
    bio: 'Serving in Kano. Data & analytics. Learning every day.',
    stage: 'serving', state: 'Kano', profession: 'Data Analysis',
    skills: ['SQL', 'Excel', 'Power BI'], lookingFor: ['Internships'],
    followers: 210, following: 190, joined: 'Joined Apr 2026',
  },
  '@brighthomes': {
    id: 'u_bright', name: 'Bright Homes', handle: '@brighthomes', avatar: 'B',
    bio: 'Verified accommodation provider for corps members. Ibadan & Lagos.',
    stage: 'business', state: 'Oyo', profession: 'Accommodation',
    skills: [], lookingFor: [], followers: 1890, following: 40, joined: 'Business · Joined 2025',
  },
}

export const posts = [
  {
    id: 1, author: '@david_codes', time: '2h', tag: 'Serving · Lagos',
    text: 'Just arrived in Ibadan today. Anyone serving around Bodija? Looking for affordable accommodation and people to connect with. #CorperLife #CorperInIbadan',
    likes: 42, comments: 12, reposts: 5,
  },
  {
    id: 2, author: '@amara_serves', time: '5h', tag: 'Ex-corper · Oyo',
    text: 'Things I wish I knew before camp: bring extra white socks, a padlock, and small cash. The Mami market will humble you 😅. Ask me anything about Iseyin camp.',
    likes: 128, comments: 34, reposts: 19,
  },
  {
    id: 3, author: '@nysctech', time: '8h', tag: 'Community',
    poll: {
      question: "What's been the hardest part of NYSC so far?",
      options: [
        { label: 'Accommodation', pct: 41 },
        { label: 'PPA placement', pct: 27 },
        { label: 'Transport', pct: 18 },
        { label: 'Making friends', pct: 14 },
      ],
      votes: '1,204 votes',
    },
    likes: 76, comments: 41, reposts: 22,
  },
  {
    id: 4, author: '@fatima_b', time: '11h', tag: 'Serving · Kano',
    text: 'CDS today was actually fun. Met other data people in my zone. If you are in Kano and into analytics, gbe here 👋 #NYSC2026',
    likes: 51, comments: 9, reposts: 3,
  },
  {
    id: 5, author: '@chidi_dev', time: '1d', tag: 'Serving · Lagos',
    text: 'Shipped my first feature at my PPA today. Startups move fast — learning so much more than I expected. Grateful. #CorperLife',
    likes: 94, comments: 15, reposts: 7,
  },
]

export const comments = {
  1: [
    { author: '@amara_serves', time: '1h', text: 'Welcome to Ibadan! Bodija is great. Check Explore, a few corper lodges are listed there.' },
    { author: '@chidi_dev', time: '45m', text: 'I know someone with a self-con near the secretariat. DM me.' },
  ],
  2: [
    { author: '@fatima_b', time: '4h', text: 'The padlock advice is so real 😂 saved me.' },
    { author: '@david_codes', time: '3h', text: 'Thank you! How was registration on camp day?' },
  ],
}

export const trending = [
  { tag: '#NYSCRelocation', posts: '3,204 posts' },
  { tag: '#CorperInLagos', posts: '1,876 posts' },
  { tag: 'PPA experiences', posts: '980 posts' },
  { tag: 'Ibadan accommodation', posts: '742 posts' },
]

export const suggested = ['@chidi_dev', '@fatima_b', '@brighthomes']

export const places = [
  { id: 'p1', name: "Mama's Kitchen", cat: 'Food & restaurants', type: 'Affordable food · Bodija', rating: 4.7, reviews: 86,
    note: 'Good portions and cheap. A lot of corps members eat here.',
    tips: ['Ask for the ₦700 special', 'Busy after 2pm', 'They deliver around Bodija'] },
  { id: 'p2', name: 'Corper Lodge Bodija', cat: 'Accommodation', type: 'Accommodation · Ibadan', rating: 4.3, reviews: 54,
    note: 'Shared self-con units. Close to secretariat and the market.',
    tips: ['Bring your own padlock', 'Water runs early morning', 'Negotiate yearly rent'] },
  { id: 'p3', name: 'QuickPrint Hub', cat: 'Printing / cyber', type: 'Printing · Near camp gate', rating: 4.5, reviews: 38,
    note: 'Fast printing, lamination and passport photos. Open early.',
    tips: ['Go before 9am', 'Card & transfer accepted'] },
  { id: 'p4', name: 'Agodi General Hospital', cat: 'Hospitals', type: 'Hospital · Agodi', rating: 4.1, reviews: 22,
    note: 'Reliable for corps members. NYSC clinic referrals accepted here.',
    tips: ['Bring your NYSC ID', 'Mornings are less crowded'] },
]

export const exploreCategories = [
  'Accommodation', 'Food & restaurants', 'Transport', 'Hospitals',
  'Pharmacies', 'ATMs & banks', 'Printing / cyber', 'Markets',
]

export const listings = [
  { id: 'l1', title: 'Foam mattress (6x6) — clean', price: '₦28,000', cat: 'Furniture', loc: 'Bodija, Ibadan', seller: 'Outgoing corper', handle: '@amara_serves' },
  { id: 'l2', title: 'HP EliteBook, 8GB RAM', price: '₦145,000', cat: 'Laptops', loc: 'Yaba, Lagos', seller: 'Serving corper', handle: '@chidi_dev' },
  { id: 'l3', title: 'Gas cooker + small cylinder', price: '₦19,500', cat: 'Kitchen', loc: 'Enugu', seller: 'Serving corper', handle: '@fatima_b' },
  { id: 'l4', title: 'Self-con near secretariat', price: '₦180,000/yr', cat: 'Accommodation', loc: 'Agodi, Ibadan', seller: 'Verified agent', handle: '@brighthomes' },
  { id: 'l5', title: 'Android phone (Infinix)', price: '₦72,000', cat: 'Phones', loc: 'Kaduna', seller: 'Serving corper', handle: '@fatima_b' },
  { id: 'l6', title: 'Reading table & chair', price: '₦15,000', cat: 'Furniture', loc: 'Lagos', seller: 'Outgoing corper', handle: '@david_codes' },
]

export const marketplaceCategories = ['All', 'Phones', 'Laptops', 'Furniture', 'Fashion', 'Kitchen', 'Books', 'Accommodation']

export const groups = [
  { id: 'g1', name: 'Tech Corps Members', members: '12.4k', desc: 'Developers, designers and data folks serving nationwide.' },
  { id: 'g2', name: 'NYSC Entrepreneurs', members: '8.1k', desc: 'Building businesses during and after service.' },
  { id: 'g3', name: 'Corps Members in Lagos', members: '21.7k', desc: 'Accommodation, transport and meetups in Lagos.' },
  { id: 'g4', name: 'Corps Members in Oyo', members: '9.6k', desc: 'Ibadan-based discussions, PPA and living tips.' },
]

export const opportunities = [
  { id: 'o1', type: 'Jobs', title: 'Frontend Developer (Entry)', org: 'Paystack', loc: 'Remote · Nigeria', meta: 'Full-time · ₦300k–450k', desc: 'Join a small product team building payment experiences. React experience required.' },
  { id: 'o2', type: 'Internships', title: 'Data Analyst Intern', org: 'Andela', loc: 'Lagos', meta: '6 months · Stipend', desc: 'Support the analytics team with dashboards and reporting. SQL a plus.' },
  { id: 'o3', type: 'Scholarships', title: 'Tech4Dev Women Scholarship', org: 'Tech4Dev', loc: 'Online', meta: 'Applications open', desc: 'Fully-funded training scholarship for women in tech.' },
  { id: 'o4', type: 'Training', title: 'Product Design Bootcamp', org: 'AltSchool', loc: 'Hybrid', meta: 'Weekends · Certificate', desc: 'Learn product design fundamentals over 8 weekends.' },
]

export const opportunityFilters = ['All', 'Jobs', 'Internships', 'Scholarships', 'Training']

export const events = [
  { id: 'e1', title: 'Tech Corps Meetup', org: 'NaijaCorper', date: 'Sat, 14 Sep · 2:00 PM', loc: 'Ibadan, Oyo', going: 62, desc: 'Meet other tech corps members in Oyo. Lightning talks, jollof and networking.' },
  { id: 'e2', title: 'CDS Career Fair', org: 'NYSC Lagos', date: 'Fri, 20 Sep · 10:00 AM', loc: 'Alausa, Lagos', going: 140, desc: 'Recruiters, startups and training providers under one roof.' },
  { id: 'e3', title: 'NYSC Entrepreneurs Mixer', org: 'NYSC Entrepreneurs', date: 'Sun, 22 Sep · 4:00 PM', loc: 'Enugu', going: 45, desc: 'For corps members building businesses during service.' },
]

export const ppas = [
  { id: 'ppa1', name: 'Paystack', loc: 'Lagos', rating: 4.6, reviews: 31, env: 'Excellent', learning: 'High', workload: 'Moderate',
    review: 'Great mentorship and real projects. They treat corps members like full staff.' },
  { id: 'ppa2', name: 'First Bank (Branch)', loc: 'Ibadan', rating: 3.8, reviews: 44, env: 'Good', learning: 'Moderate', workload: 'High',
    review: 'Structured but busy. Good if you want banking experience.' },
  { id: 'ppa3', name: 'State Secretariat', loc: 'Enugu', rating: 3.2, reviews: 27, env: 'Average', learning: 'Low', workload: 'Light',
    review: 'Relaxed but not much to learn. Good for people with side projects.' },
  { id: 'ppa4', name: 'Andela', loc: 'Remote', rating: 4.4, reviews: 18, env: 'Great', learning: 'High', workload: 'Moderate',
    review: 'Remote-friendly, strong engineering culture.' },
]

export const stateGuides = [
  { state: 'Lagos', tagline: 'Fast, expensive, full of opportunity',
    getAround: 'Danfo, BRT buses and ride-hailing. Avoid rush hour on the mainland.',
    eat: 'Yaba and Surulere have cheap corper-friendly spots.',
    stay: 'Yaba, Ojota and Ikeja are central. Rents are high — share where you can.',
    know: 'Keep transport money separate. Traffic is real. CDS zones vary widely.' },
  { state: 'Oyo', tagline: 'Affordable, calm, student city energy',
    getAround: 'Micra taxis and okada. Bodija and Agodi are central.',
    eat: "Bodija has great cheap food. Mama's Kitchen is a corper favourite.",
    stay: 'Bodija and Agodi are close to the secretariat.',
    know: 'Living costs are low. Great first posting for saving money.' },
  { state: 'Enugu', tagline: 'Green, relaxed and friendly',
    getAround: 'Keke and shared cabs. The city is compact.',
    eat: 'New Haven and Independence Layout have good spots.',
    stay: 'Independence Layout is popular and safe.',
    know: 'Cool weather. Very welcoming to corps members.' },
]

export const notifications = [
  { id: 'n1', type: 'like', who: '@amara_serves', text: 'liked your post', time: '20m' },
  { id: 'n2', type: 'comment', who: '@chidi_dev', text: 'replied to your post', time: '1h' },
  { id: 'n3', type: 'follow', who: '@fatima_b', text: 'started following you', time: '3h' },
  { id: 'n4', type: 'message', who: '@brighthomes', text: 'sent you a message', time: '5h' },
  { id: 'n5', type: 'opportunity', who: 'Opportunities', text: 'New Frontend Developer role at Paystack', time: '1d' },
  { id: 'n6', type: 'event', who: 'Events', text: 'Tech Corps Meetup is this Saturday', time: '1d' },
]

export const conversations = [
  { id: 'c1', handle: '@amara_serves', last: 'Sure, ask me anything about camp!', time: '2h', unread: true,
    messages: [
      { from: 'them', text: 'Welcome to Ibadan! How are you settling in?', time: '3h' },
      { from: 'me', text: 'Thanks! Still looking for accommodation around Bodija.', time: '2h' },
      { from: 'them', text: 'Sure, ask me anything about camp!', time: '2h' },
    ] },
  { id: 'c2', handle: '@brighthomes', last: 'The self-con is still available.', time: '5h', unread: true,
    messages: [
      { from: 'me', text: 'Hi, is the self-con near the secretariat still available?', time: '6h' },
      { from: 'them', text: 'The self-con is still available.', time: '5h' },
    ] },
  { id: 'c3', handle: '@chidi_dev', last: 'Let’s catch up at the meetup 👍', time: '1d', unread: false,
    messages: [
      { from: 'them', text: 'You coming to the tech meetup Saturday?', time: '1d' },
      { from: 'me', text: 'Yeah planning to!', time: '1d' },
      { from: 'them', text: 'Let’s catch up at the meetup 👍', time: '1d' },
    ] },
]

// Onboarding option sets
export const nyscStages = [
  'Waiting for mobilization', 'Waiting for call-up', 'Waiting for deployment',
  'Received call-up letter', 'Preparing for camp', 'Other',
]

export const nigerianStates = [
  'Abia', 'Abuja/FCT', 'Adamawa', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa',
  'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger',
  'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
  "I don't know yet",
]

export const interestOptions = [
  'NYSC updates', 'Orientation camp', 'Relocation', 'Accommodation', 'Jobs',
  'Business', 'Technology', 'Networking', 'Making friends', 'NYSC tips',
  'Career opportunities', 'Entrepreneurship',
]

// Assistant canned answers (frontend-only, no real AI)
export const assistantSuggestions = [
  'What should I take to camp?',
  'How does NYSC relocation work?',
  'What happens if I miss CDS?',
  'What documents do I need?',
]

export const assistantAnswers = {
  camp: "For camp, pack: white round-neck shirts and shorts, white socks and canvas, a padlock, a bucket, toiletries, some cash (Mami market is cash-heavy), a torch/power bank, and photocopies of your call-up letter and ID. Travel light but bring essentials — you can buy more at the Mami market.",
  relocation: "Relocation lets you move your service to another state, usually for marriage, health or security reasons. You apply through the NYSC portal or your zonal office with supporting documents. Approval isn't guaranteed, so prepare genuine evidence. Community tip: many corps members share their relocation experiences under #NYSCRelocation.",
  cds: "CDS (Community Development Service) attendance is compulsory. Missing it without a valid, documented reason can affect your clearance and monthly allowance. If you must miss one, inform your CDS group leader or LGI in advance. Note: this is general community guidance — always confirm with your official NYSC channel.",
  documents: "Commonly required documents: your call-up letter, statement of result / degree certificate, school ID, a valid means of ID, passport photographs, and your green card once you're serving. Keep both physical and digital copies.",
  default: "I can help with NYSC and service-year questions — camp preparation, relocation, CDS, documents, PPA and more. This is community-oriented guidance; always confirm important details with official NYSC channels.",
}
