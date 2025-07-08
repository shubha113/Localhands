export const USER_ROLES = {
    USER: 'user',
    PROVIDER: 'provider',
    ADMIN: 'admin'
};

export const BOOKING_STATUS = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    EXPIRED: 'expired'
};

export const PAYMENT_STATUS = {
    PENDING: 'pending',
    SUCCESS: 'success',
    FAILED: 'failed',
    REFUNDED: 'refunded'
};

export const PROVIDER_STATUS = {
    PENDING: 'pending',
    VERIFIED: 'verified',
    REJECTED: 'rejected',
    SUSPENDED: 'suspended'
};

export const COMMISSION_RATE = 0.10; 


export const SERVICE_CATEGORIES = [
  'Home Repair & Maintenance',
  'Cleaning & Housekeeping',
  'Beauty & Wellness',
  'Automotive Services',
  'Personal & Errands',
  'Tutoring & Education',
  'Event Services',
  'Pet Care',
  'Professional Services',
  'Daily Wage Labor',
  'Other',
];

export const SERVICE_SUBCATEGORIES = {
  'Home Repair & Maintenance': [
    { name: 'Plumbing', description: 'Fix leaks, install and repair pipes, unclog drains, and maintain water systems.' },
    { name: 'Electrical', description: 'Install, repair, or maintain electrical wiring, outlets, switches, and fixtures.' },
    { name: 'Carpentry', description: 'Build, repair, or install wooden structures, doors, windows, and furniture.' },
    { name: 'Painting', description: 'Interior and exterior painting for walls, ceilings, doors, and more.' },
    { name: 'Appliance Repair', description: 'Diagnose and fix household appliances like washing machines, refrigerators, and ovens.' },
    { name: 'HVAC Repair', description: 'Service and repair heating, ventilation, and air conditioning systems.' },
    { name: 'Handyman Services', description: 'General maintenance tasks, small repairs, and home improvement projects.' },
    { name: 'Roofing', description: 'Repair, replace, or install roofs to protect your home.' },
    { name: 'Masonry', description: 'Construct or repair brick, stone, or concrete structures like walls and patios.' },
    { name: 'Pest Control', description: 'Eliminate and prevent pests such as insects, rodents, and termites.' },
    { name: 'Gardening & Landscaping', description: 'Plant care, lawn maintenance, landscape design, and outdoor beautification.' },
    { name: 'Waterproofing', description: 'Prevent or repair water leaks in basements, roofs, and walls.' },
    { name: 'Home Security Systems', description: 'Install and maintain security cameras, alarms, and surveillance systems.' },
    { name: 'Intercom & Doorbell Repair', description: 'Fix or install intercoms, doorbells, and access control systems.' },
    { name: 'Furniture Assembly', description: 'Assemble beds, tables, shelves, and flat-pack furniture.' },
    { name: 'Smart Home Device Setup', description: 'Install and configure smart lights, thermostats, cameras, and other IoT devices.' },
  ],
  'Cleaning & Housekeeping': [
    { name: 'Home Cleaning (Deep)', description: 'Thorough cleaning of your entire home, including hard-to-reach areas.' },
    { name: 'Home Cleaning (Standard)', description: 'Regular cleaning of living spaces to keep your home tidy and fresh.' },
    { name: 'Commercial Cleaning', description: 'Cleaning services for offices, shops, and commercial properties.' },
    { name: 'Sofa & Carpet Cleaning', description: 'Deep cleaning of sofas, couches, carpets, and rugs.' },
    { name: 'Bathroom Cleaning', description: 'Sanitize and clean bathrooms, removing stains, mold, and grime.' },
    { name: 'Kitchen Cleaning', description: 'Clean countertops, cabinets, sinks, appliances, and kitchen surfaces.' },
    { name: 'Window Cleaning', description: 'Wash and polish interior and exterior windows for streak-free shine.' },
    { name: 'Pressure Washing', description: 'High-pressure cleaning for driveways, patios, walls, and outdoor surfaces.' },
    { name: 'Move-in/Move-out Cleaning', description: 'Detailed cleaning before moving in or after moving out of a property.' },
    { name: 'Laundry & Ironing', description: 'Wash, dry, fold, and iron clothes or linens.' },
    { name: 'Maid Service', description: 'Regular housekeeping, including cleaning, tidying, and basic chores.' },
  ],
  'Beauty & Wellness': [
    { name: 'Haircut & Styling (Men)', description: 'Haircuts, beard trims, and hairstyling for men.' },
    { name: 'Haircut & Styling (Women)', description: 'Haircuts, coloring, and hairstyling for women.' },
    { name: 'Manicure & Pedicure', description: 'Nail trimming, shaping, cuticle care, and polish for hands and feet.' },
    { name: 'Facial', description: 'Cleansing, exfoliation, and treatments to rejuvenate your skin.' },
    { name: 'Massage Therapy', description: 'Relaxing and therapeutic massages to relieve stress and pain.' },
    { name: 'Makeup Artist', description: 'Professional makeup for parties, weddings, or events.' },
    { name: 'Waxing', description: 'Hair removal for face, arms, legs, or body.' },
    { name: 'Bridal Services', description: 'Comprehensive beauty packages for brides on their wedding day.' },
    { name: 'Yoga & Fitness Trainer', description: 'Personalized yoga or fitness sessions for health and wellness.' },
    { name: 'Dietitian & Nutritionist', description: 'Expert dietary advice and meal planning for better health.' },
  ],
  'Automotive Services': [
    { name: 'Car Repair & Maintenance', description: 'Mechanical repairs, engine service, oil changes, and more for cars.' },
    { name: 'Bike Repair & Maintenance', description: 'Repair and servicing for motorcycles and scooters.' },
    { name: 'Car Washing & Detailing', description: 'Exterior and interior car cleaning, polishing, and waxing.' },
    { name: 'Tyre Repair & Replacement', description: 'Fix or replace flat, damaged, or worn-out tires.' },
    { name: 'Battery Replacement', description: 'Install new batteries or check charging systems for vehicles.' },
    { name: 'Roadside Assistance', description: 'Emergency help for breakdowns, jump-starts, fuel delivery, or towing.' },
    { name: 'Vehicle Inspection', description: 'Comprehensive checks to ensure your vehicle’s roadworthiness.' },
  ],
  'Personal & Errands': [
    { name: 'Grocery Delivery', description: 'Shop for and deliver groceries directly to your doorstep.' },
    { name: 'Document Delivery', description: 'Pick up and deliver important documents or parcels securely.' },
    { name: 'Personal Shopping', description: 'Assistance with purchasing clothes, gifts, or household items.' },
    { name: 'Elderly Care', description: 'Support for seniors with daily tasks, companionship, and care.' },
    { name: 'Child Care / Babysitting', description: 'Qualified sitters to watch, care for, and entertain children.' },
    { name: 'Courier Services', description: 'Fast delivery of packages and parcels within the city.' },
    { name: 'Queueing Services', description: 'Someone to stand in line for tickets, appointments, or services.' },
  ],
  'Tutoring & Education': [
    { name: 'Academic Tutoring', description: 'Help with school or college subjects for better grades.' },
    { name: 'Music Lessons', description: 'Learn to play instruments like guitar, piano, drums, or vocals.' },
    { name: 'Language Lessons', description: 'Learn new languages or improve proficiency with an expert tutor.' },
    { name: 'Exam Preparation', description: 'Focused coaching to excel in board, entrance, or competitive exams.' },
    { name: 'Computer & IT Skills', description: 'Learn software, coding, or basic computer skills.' },
    { name: 'Art & Craft Classes', description: 'Workshops in painting, drawing, craft making, and creative skills.' },
  ],
  'Event Services': [
    { name: 'Event Planning', description: 'Coordinate and organize weddings, parties, or corporate events.' },
    { name: 'Photography', description: 'Capture memorable moments with professional photography services.' },
    { name: 'Videography', description: 'Record high-quality videos of events and special occasions.' },
    { name: 'Catering', description: 'Provide delicious food and beverages for gatherings or celebrations.' },
    { name: 'Decorations', description: 'Set up themed decorations and event styling.' },
    { name: 'DJ Services', description: 'Music mixing and entertainment by professional DJs.' },
    { name: 'Live Music', description: 'Hire bands, singers, or instrumentalists for live performances.' },
    { name: 'Waitstaff', description: 'Experienced servers for smooth service at your event.' },
  ],
  'Pet Care': [
    { name: 'Pet Grooming', description: 'Bathing, haircuts, nail trimming, and cleaning for pets.' },
    { name: 'Pet Sitting', description: 'Look after pets at your home or sitter’s place while you’re away.' },
    { name: 'Dog Walking', description: 'Daily or occasional walks for your dogs.' },
    { name: 'Pet Training', description: 'Teach pets obedience, commands, or behavioral training.' },
    { name: 'Veterinary Assistance (non-medical)', description: 'Basic care like feeding, administering meds, or transport.' },
  ],
  'Professional Services': [
    { name: 'IT Support', description: 'Fix computer problems, set up networks, and troubleshoot devices.' },
    { name: 'Graphic Design', description: 'Design logos, brochures, social media posts, and marketing materials.' },
    { name: 'Web Development', description: 'Build or maintain websites and web applications.' },
    { name: 'Content Writing', description: 'Write articles, blogs, product descriptions, and copywriting.' },
    { name: 'Legal Consultation (basic)', description: 'General legal advice and assistance with documents or processes.' },
    { name: 'Accounting & Bookkeeping', description: 'Manage finances, prepare statements, and record transactions.' },
    { name: 'Tax Preparation', description: 'File personal or business taxes and ensure compliance.' },
    { name: 'Marketing & SEO', description: 'Improve online presence with marketing strategies and SEO optimization.' },
    { name: 'Photography (Professional)', description: 'Studio-quality shoots for portraits, products, or ads.' },
    { name: 'Consulting', description: 'Expert advice to help improve business or personal projects.' },
  ],
  'Daily Wage Labor': [
    { name: 'General Labor', description: 'Assist with various manual tasks requiring physical effort.' },
    { name: 'Construction Helper', description: 'Support construction workers with materials and site tasks.' },
    { name: 'Farm Labor', description: 'Work in farms with planting, harvesting, or tending crops.' },
    { name: 'Household Helper', description: 'Assist with moving, cleaning, or organizing in homes.' },
    { name: 'Gardening Assistant', description: 'Help with planting, weeding, and garden maintenance.' },
    { name: 'Loading/Unloading', description: 'Move heavy items during shifting, delivery, or events.' },
    { name: 'Event Setup/Takedown', description: 'Set up stages, chairs, and decorations for events, and dismantle afterward.' },
    { name: 'Cleaning Assistant', description: 'Assist professional cleaners with tasks during large jobs.' },
    { name: 'Delivery Helper', description: 'Support delivery personnel in carrying and organizing packages.' },
    { name: 'Coolie/Porter', description: 'Carry luggage or heavy items at stations, airports, or markets.' },
  ],
  'Other': [
    { name: 'Custom Request', description: 'Any specialized service not listed in the categories above.' },
    { name: 'Miscellaneous', description: 'General tasks and odd jobs that don’t fit in specific categories.' },
  ],
};
