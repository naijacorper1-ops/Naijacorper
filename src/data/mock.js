// Sample data for the screens the backend does not cover yet:
// Opportunities, Events, PPA reviews, State guides and the Assistant.
// Everything else now comes from the API.

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
