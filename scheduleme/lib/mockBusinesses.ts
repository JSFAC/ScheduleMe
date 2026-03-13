// lib/mockBusinesses.ts — shared mock data for home, browse, and business profiles

export interface Business {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviews: number;
  distance: string;
  price_tier: number;
  available: boolean;
  badge?: string | null;
  tagline: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  hours: { day: string; time: string }[];
  services: { name: string; price: string }[];
  coverUrl: string;
  allImages: string[];
  lat: number;
  lng: number;
  sponsored?: boolean;
  independent?: boolean;
  topReview?: string;
  reviewer?: { name: string; avatarUrl: string };
}

export const ALL_BUSINESSES: Business[] = [
  {
    id: '1',
    name: 'Pacific Plumbing Co.',
    category: 'Plumbing',
    rating: 4.9, reviews: 127, distance: '0.8 mi', price_tier: 2,
    available: true, badge: 'Top Rated', sponsored: true,
    tagline: 'Same-day emergency service. Licensed & insured.',
    topReview: '"Fixed our leak at midnight — showed up in 20 min. Absolute lifesaver."',
    reviewer: { name: 'Marcus T.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80' },
    description: 'Pacific Plumbing Co. has served the Bay Area for over 15 years. We handle everything from leaky faucets to full pipe replacements — same-day availability for emergencies. All technicians are licensed, bonded, and insured.',
    address: '819 Valencia St, San Francisco, CA 94110',
    phone: '(415) 555-0192', email: 'hello@pacificplumbing.com',
    hours: [
      { day: 'Mon–Fri', time: '7:00 AM – 7:00 PM' },
      { day: 'Saturday', time: '8:00 AM – 5:00 PM' },
      { day: 'Sunday', time: 'Emergency only' },
    ],
    services: [
      { name: 'Leak detection & repair', price: 'From $95' },
      { name: 'Drain cleaning', price: 'From $75' },
      { name: 'Water heater install', price: 'From $450' },
      { name: 'Pipe replacement', price: 'Quote required' },
    ],
    coverUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80',
    allImages: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80',
      'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&q=75',
      'https://images.unsplash.com/photo-1585704032915-c3400305e979?w=600&q=75',
      'https://images.unsplash.com/photo-1573588028698-f4759befb09a?w=600&q=75',
      'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=600&q=75',
    ],
    lat: 37.775, lng: -122.418,
  },
  {
    id: '2',
    name: 'Sparkle Clean SF',
    category: 'House Cleaning',
    rating: 4.8, reviews: 89, distance: '1.2 mi', price_tier: 1,
    available: true, badge: 'Fast Response', sponsored: true,
    tagline: 'Deep cleans, recurring service, eco-friendly products.',
    topReview: '"Left our apartment spotless. Even cleaned behind the fridge. Incredible."',
    reviewer: { name: 'Priya S.', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&q=80' },
    description: 'Sparkle Clean SF is a locally owned cleaning company specializing in residential and small office spaces. We use only eco-certified products. All staff are background-checked, and we\'re fully insured.',
    address: '2390 Mission St, San Francisco, CA 94110',
    phone: '(415) 555-0108', email: 'team@sparkleclean.com',
    hours: [
      { day: 'Mon–Sat', time: '8:00 AM – 6:00 PM' },
      { day: 'Sunday', time: 'By appointment' },
    ],
    services: [
      { name: 'Standard clean', price: 'From $120' },
      { name: 'Deep clean', price: 'From $220' },
      { name: 'Move-in / Move-out', price: 'From $280' },
      { name: 'Recurring (weekly)', price: 'From $95/visit' },
    ],
    coverUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900&q=80',
    allImages: [
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900&q=80',
      'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=600&q=75',
      'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=600&q=75',
      'https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=600&q=75',
      'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=75',
    ],
    lat: 37.779, lng: -122.413,
  },
  {
    id: '3',
    name: 'Bay Area Electric',
    category: 'Electrical',
    rating: 4.7, reviews: 203, distance: '2.1 mi', price_tier: 2,
    available: false, badge: 'Licensed & Insured', sponsored: true,
    tagline: 'Panel upgrades, EV charger installation, 24/7 service.',
    topReview: '"Installed our EV charger fast and clean. Great communication throughout."',
    reviewer: { name: 'James K.', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&q=80' },
    description: 'Bay Area Electric provides full-service residential and commercial electrical work. From simple outlet repairs to complete panel upgrades and EV charger installations. C-10 licensed, fully insured, and serving the Bay since 2008.',
    address: '450 Brannan St, San Francisco, CA 94107',
    phone: '(415) 555-0241', email: 'service@bayareaelectric.com',
    hours: [
      { day: 'Mon–Fri', time: '7:00 AM – 8:00 PM' },
      { day: 'Sat–Sun', time: '9:00 AM – 5:00 PM' },
    ],
    services: [
      { name: 'Outlet & switch repair', price: 'From $85' },
      { name: 'Panel upgrade', price: 'From $1,200' },
      { name: 'EV charger install', price: 'From $650' },
      { name: 'Lighting install', price: 'From $150' },
    ],
    coverUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=900&q=80',
    allImages: [
      'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=900&q=80',
      'https://images.unsplash.com/photo-1558002038-1055907df827?w=600&q=75',
      'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=600&q=75',
      'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600&q=75',
      'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&q=75',
    ],
    lat: 37.771, lng: -122.422,
  },
  {
    id: '4',
    name: 'Green Thumb Gardens',
    category: 'Landscaping',
    rating: 5.0, reviews: 44, distance: '0.5 mi', price_tier: 1,
    available: true, badge: null, sponsored: true,
    tagline: 'Lawn care, garden design, and seasonal maintenance.',
    topReview: '"Transformed our dead lawn in one day. Worth every penny."',
    reviewer: { name: 'Sofia R.', avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&q=80' },
    description: 'Green Thumb Gardens is a small family-run landscaping company in the Mission. We love transforming outdoor spaces — from simple lawn maintenance to full garden redesigns. Sustainable practices, fair prices.',
    address: '3246 24th St, San Francisco, CA 94110',
    phone: '(415) 555-0377', email: 'hello@greenthumbsf.com',
    hours: [
      { day: 'Mon–Sat', time: '7:30 AM – 6:00 PM' },
      { day: 'Sunday', time: 'Closed' },
    ],
    services: [
      { name: 'Lawn mowing', price: 'From $55' },
      { name: 'Garden cleanup', price: 'From $120' },
      { name: 'Garden design', price: 'Quote required' },
      { name: 'Irrigation setup', price: 'From $300' },
    ],
    coverUrl: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=900&q=80',
    allImages: [
      'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=900&q=80',
      'https://images.unsplash.com/photo-1558904541-efa843a96f01?w=600&q=75',
      'https://images.unsplash.com/photo-1585320806297-9794b3e4aaae?w=600&q=75',
      'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=600&q=75',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=75',
    ],
    lat: 37.773, lng: -122.420,
  },
  {
    id: '5',
    name: 'Summit HVAC',
    category: 'HVAC',
    rating: 4.6, reviews: 156, distance: '3.4 mi', price_tier: 3,
    available: true, badge: null, independent: true,
    tagline: 'Heating, cooling, and ventilation — installed right.',
    topReview: '"AC died in a heatwave. They were here in 2 hours. Incredibly professional."',
    reviewer: { name: 'David L.', avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&q=80' },
    description: 'Summit HVAC has been keeping Bay Area homes comfortable for 12 years. We install, repair, and maintain all major HVAC brands. Free estimates. Financing available for larger jobs.',
    address: '1200 Howard St, San Francisco, CA 94103',
    phone: '(415) 555-0519', email: 'info@summithvac.com',
    hours: [
      { day: 'Mon–Fri', time: '8:00 AM – 6:00 PM' },
      { day: 'Saturday', time: '9:00 AM – 3:00 PM' },
      { day: 'Sunday', time: 'Closed' },
    ],
    services: [
      { name: 'AC tune-up', price: 'From $89' },
      { name: 'Furnace repair', price: 'From $150' },
      { name: 'New AC install', price: 'From $2,800' },
      { name: 'Duct cleaning', price: 'From $350' },
    ],
    coverUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&q=80',
    allImages: [
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=900&q=80',
      'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=75',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=75',
      'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&q=75',
      'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&q=75',
    ],
    lat: 37.768, lng: -122.415,
  },
  {
    id: '6',
    name: 'Canvas & Coat',
    category: 'Painting',
    rating: 4.9, reviews: 71, distance: '1.8 mi', price_tier: 2,
    available: true, badge: 'Top Rated', independent: true,
    tagline: 'Interior and exterior painting. Free estimates in 24 hrs.',
    topReview: '"Cleanest paint job I\'ve ever seen. No drips, finished ahead of schedule."',
    reviewer: { name: 'Aisha M.', avatarUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=80&q=80' },
    description: 'Canvas & Coat is a boutique painting company known for clean prep work and flawless finishes. We handle everything from single rooms to full exterior repaints. Family owned, locally based in the Inner Sunset.',
    address: '1450 Irving St, San Francisco, CA 94122',
    phone: '(415) 555-0634', email: 'quotes@canvasandcoat.com',
    hours: [
      { day: 'Mon–Fri', time: '8:00 AM – 6:00 PM' },
      { day: 'Saturday', time: '9:00 AM – 4:00 PM' },
      { day: 'Sunday', time: 'Closed' },
    ],
    services: [
      { name: 'Interior room paint', price: 'From $250' },
      { name: 'Full interior repaint', price: 'From $1,400' },
      { name: 'Exterior painting', price: 'From $2,200' },
      { name: 'Cabinet painting', price: 'From $600' },
    ],
    coverUrl: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=900&q=80',
    allImages: [
      'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=900&q=80',
      'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&q=75',
      'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=600&q=75',
      'https://images.unsplash.com/photo-1516455590571-18256e5bb9ff?w=600&q=75',
      'https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=600&q=75',
    ],
    lat: 37.776, lng: -122.410,
  },
  {
    id: '7',
    name: 'Rapid Response Plumbing',
    category: 'Plumbing',
    rating: 4.8, reviews: 312, distance: '2.5 mi', price_tier: 2,
    available: true, badge: null, independent: true,
    tagline: '24/7 emergency plumbing. No overtime charges.',
    topReview: '"No overtime fees — they charged exactly what they quoted. Finally."',
    reviewer: { name: 'Kevin B.', avatarUrl: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=80&q=80' },
    description: 'Rapid Response Plumbing is the go-to for same-day and emergency calls in SF. We never charge overtime rates. Flat-rate pricing on most jobs. Over 300 five-star reviews and counting.',
    address: '742 Clement St, San Francisco, CA 94118',
    phone: '(415) 555-0773', email: 'dispatch@rapidplumbing.com',
    hours: [
      { day: 'Every day', time: '24 hours / 7 days' },
    ],
    services: [
      { name: 'Emergency call-out', price: 'From $150' },
      { name: 'Drain unclogging', price: 'From $95' },
      { name: 'Toilet repair', price: 'From $85' },
      { name: 'Sewer inspection', price: 'From $200' },
    ],
    coverUrl: 'https://images.unsplash.com/photo-1573588028698-f4759befb09a?w=900&q=80',
    allImages: [
      'https://images.unsplash.com/photo-1573588028698-f4759befb09a?w=900&q=80',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=75',
      'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=600&q=75',
      'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&q=75',
      'https://images.unsplash.com/photo-1585704032915-c3400305e979?w=600&q=75',
    ],
    lat: 37.780, lng: -122.416,
  },
  {
    id: '8',
    name: 'Merry Maids Pro',
    category: 'House Cleaning',
    rating: 4.9, reviews: 445, distance: '0.9 mi', price_tier: 1,
    available: true, badge: null, independent: true,
    tagline: 'Recurring and one-time cleans. Bonded and insured.',
    topReview: '"445 reviews doesn\'t lie — this is the best cleaning service I\'ve found."',
    reviewer: { name: 'Lauren H.', avatarUrl: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=80&q=80' },
    description: 'Merry Maids Pro is a community favorite with 445 reviews across SF. We specialize in recurring weekly and bi-weekly cleans for busy households. Bonded, insured, and background-checked staff.',
    address: '3901 Noriega St, San Francisco, CA 94122',
    phone: '(415) 555-0882', email: 'book@merrymaids.pro',
    hours: [
      { day: 'Mon–Sat', time: '8:00 AM – 5:00 PM' },
      { day: 'Sunday', time: 'Closed' },
    ],
    services: [
      { name: 'Weekly clean', price: 'From $90/visit' },
      { name: 'Bi-weekly clean', price: 'From $110/visit' },
      { name: 'One-time deep clean', price: 'From $200' },
      { name: 'Post-renovation clean', price: 'From $300' },
    ],
    coverUrl: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=900&q=80',
    allImages: [
      'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=900&q=80',
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&q=75',
      'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=600&q=75',
      'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=75',
      'https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=600&q=75',
    ],
    lat: 37.774, lng: -122.419,
  },
  {
    id: '9',
    name: 'HandyPro Services',
    category: 'Handyman',
    rating: 4.7, reviews: 88, distance: '1.1 mi', price_tier: 1,
    available: true, badge: 'Fast Response', independent: true,
    tagline: 'General repairs, assembly, mounting, and more.',
    topReview: '"Mounted my TV and fixed two doors in under 2 hours. Super efficient."',
    reviewer: { name: 'Tom C.', avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=80&q=80' },
    description: 'HandyPro is your reliable local handyman for all the small jobs that pile up. Furniture assembly, TV mounting, minor drywall, door fixes — done right, done quickly. No job too small.',
    address: '688 Haight St, San Francisco, CA 94117',
    phone: '(415) 555-0943', email: 'mike@handyprof.com',
    hours: [
      { day: 'Mon–Fri', time: '8:00 AM – 7:00 PM' },
      { day: 'Saturday', time: '9:00 AM – 5:00 PM' },
      { day: 'Sunday', time: 'Closed' },
    ],
    services: [
      { name: 'Furniture assembly', price: 'From $60' },
      { name: 'TV mounting', price: 'From $75' },
      { name: 'Door repair', price: 'From $85' },
      { name: 'Drywall patch', price: 'From $95' },
    ],
    coverUrl: 'https://images.unsplash.com/photo-1609220136736-443140cfeaa8?w=900&q=80',
    allImages: [
      'https://images.unsplash.com/photo-1609220136736-443140cfeaa8?w=900&q=80',
      'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&q=75',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=75',
      'https://images.unsplash.com/photo-1585704032915-c3400305e979?w=600&q=75',
      'https://images.unsplash.com/photo-1573588028698-f4759befb09a?w=600&q=75',
    ],
    lat: 37.777, lng: -122.421,
  },
  // Independent section businesses
  {
    id: 'i1',
    name: "Rosa's Cleaning",
    category: 'House Cleaning',
    rating: 4.9, reviews: 31, distance: '0.6 mi', price_tier: 1,
    available: true, badge: null, independent: true,
    tagline: 'Small independent cleaner. Personal, thorough, trusted.',
    topReview: '"Rosa remembered every little preference from my first clean. Incredible."',
    reviewer: { name: 'Maria G.', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&q=80' },
    description: "Rosa has been cleaning homes in the Mission for 8 years. She works independently and takes on a small number of clients to ensure every home gets her full attention. References available.",
    address: 'Mission District, San Francisco, CA',
    phone: '(415) 555-1021', email: 'rosa.cleans@gmail.com',
    hours: [{ day: 'Tue–Sat', time: '8:00 AM – 4:00 PM' }],
    services: [
      { name: 'Standard home clean', price: 'From $100' },
      { name: 'Deep clean', price: 'From $180' },
    ],
    coverUrl: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=900&q=80',
    allImages: [
      'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=900&q=80',
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&q=75',
      'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=600&q=75',
      'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=75',
    ],
    lat: 37.760, lng: -122.415,
  },
  {
    id: 'i2',
    name: "Marco's Tile & Grout",
    category: 'Handyman',
    rating: 5.0, reviews: 18, distance: '1.4 mi', price_tier: 2,
    available: true, badge: null, independent: true,
    tagline: 'Tile work, re-grouting, bathroom fixes done right.',
    topReview: '"5 stars doesn\'t do it justice. My bathroom looks brand new."',
    reviewer: { name: 'Chris P.', avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&q=80' },
    description: "Marco is a one-man operation specializing in tile and bathroom repair. No crews, no subcontractors — just Marco doing excellent work at honest prices. Schedule fills up fast.",
    address: 'Potrero Hill, San Francisco, CA',
    phone: '(415) 555-1144', email: 'marcotile@icloud.com',
    hours: [{ day: 'Mon–Fri', time: '7:30 AM – 5:00 PM' }],
    services: [
      { name: 'Tile replacement', price: 'From $120' },
      { name: 'Re-grouting', price: 'From $90' },
      { name: 'Bathroom refresh', price: 'From $250' },
    ],
    coverUrl: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=900&q=80',
    allImages: [
      'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=900&q=80',
      'https://images.unsplash.com/photo-1564540574859-0dfb63985953?w=600&q=75',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=75',
      'https://images.unsplash.com/photo-1609220136736-443140cfeaa8?w=600&q=75',
    ],
    lat: 37.760, lng: -122.400,
  },
  {
    id: 'i3',
    name: "Dmitri's Electrical",
    category: 'Electrical',
    rating: 4.8, reviews: 24, distance: '2.0 mi', price_tier: 1,
    available: true, badge: null, independent: true,
    tagline: 'Solo electrician. Fair rates, no markups.',
    topReview: '"Honest pricing, zero surprises on the invoice. Rare to find."',
    reviewer: { name: 'Elena V.', avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=80&q=80' },
    description: "Dmitri is a licensed C-10 electrician who works solo to keep costs low. Honest flat-rate pricing on most jobs, no surprise invoices. Specializes in older homes in SF.",
    address: 'Noe Valley, San Francisco, CA',
    phone: '(415) 555-1267', email: 'dmitri.electric@gmail.com',
    hours: [{ day: 'Mon–Sat', time: '8:00 AM – 6:00 PM' }],
    services: [
      { name: 'Outlet repair', price: 'From $65' },
      { name: 'Breaker replacement', price: 'From $95' },
      { name: 'Ceiling fan install', price: 'From $110' },
    ],
    coverUrl: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=900&q=80',
    allImages: [
      'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=900&q=80',
      'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&q=75',
      'https://images.unsplash.com/photo-1558002038-1055907df827?w=600&q=75',
      'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600&q=75',
    ],
    lat: 37.750, lng: -122.435,
  },
  {
    id: 'i4',
    name: 'Greenway Landscaping',
    category: 'Landscaping',
    rating: 4.7, reviews: 12, distance: '0.9 mi', price_tier: 1,
    available: true, badge: 'New', independent: true,
    tagline: 'New to ScheduleMe. Native plants, sustainable practices.',
    topReview: '"Converted our lawn to natives in one day. The garden is stunning."',
    reviewer: { name: 'Paul N.', avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=80&q=80' },
    description: "Greenway is a small two-person team that just joined ScheduleMe. We focus on drought-tolerant and native plant gardens. Early clients get preferential pricing while we build our reviews.",
    address: 'Bernal Heights, San Francisco, CA',
    phone: '(415) 555-1389', email: 'grow@greenwaysf.com',
    hours: [{ day: 'Mon–Sat', time: '7:00 AM – 5:30 PM' }],
    services: [
      { name: 'Native plant install', price: 'From $200' },
      { name: 'Garden maintenance', price: 'From $65/visit' },
      { name: 'Lawn removal', price: 'From $400' },
    ],
    coverUrl: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=900&q=80',
    allImages: [
      'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=900&q=80',
      'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&q=75',
      'https://images.unsplash.com/photo-1558904541-efa843a96f01?w=600&q=75',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=75',
    ],
    lat: 37.742, lng: -122.414,
  },
];

export const SPONSORED = ALL_BUSINESSES.filter(b => b.sponsored);
export const INDEPENDENT = ALL_BUSINESSES.filter(b => b.independent && !b.sponsored).slice(0, 4);
export const NEARBY = ALL_BUSINESSES.filter(b => !b.sponsored).slice(0, 4);

export function getBizById(id: string): Business | undefined {
  return ALL_BUSINESSES.find(b => b.id === id);
}
