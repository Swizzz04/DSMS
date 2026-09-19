// ============================================================
// ALMIRENE DX PUBLIC WEBSITE — SINGLE SOURCE OF TRUTH
// Defaults live here. Anything a school configures in the Admin
// Portal (Settings → School Info / Website Content) is read from
// the shared 'almirene_website_content' localStorage key at load
// time and overlaid on top of these defaults automatically.
//
// To add a NEW default (a field not yet editable in the admin
// portal), just edit DEFAULTS below — no HTML/CSS changes needed.
// ============================================================

const DEFAULTS = {

  school: {
    name:     'Sample Academy',
    nameShort:'DEMO',
    tagline:  'A great place to learn and grow.',
    founded:  '2005',
    email:    'info@example.edu.ph',
    phone:    '(032) XXX-XXXX',
    logoSrc:  'assets/logo1995.png',
    navLogoSrc: 'assets/logo1995.png',
    enrollmentUrl: 'enrollment.html',
    schoolYear: '2025–2026',
  },

  stats: [
    { num: '3',   label: 'Campuses'          },
    { num: '20+', label: 'Years of Excellence'},
    { num: 'K–12',label: '+ College'          },
    { num: '2005',label: 'Est.'               },
  ],

  nav: [
    { label: 'Home',       href: '#home'       },
    { label: 'About',      href: '#about'      },
    { label: 'Campuses',   href: '#campuses'   },
    { label: 'Programs',   href: '#programs'   },
    { label: 'Admissions', href: '#admissions' },
    { label: 'Contact',    href: '#contact'    },
    { label: 'FAQ',        href: '#faq'        },
    { label: 'Enroll Now', href: 'enrollment.html', cta: true },
  ],

  about: {
    sectionLabel: 'Who We Are',
    title:    'About Our School',
    subtitle: 'Nurturing minds and hearts — building competent, values-driven graduates.',
    cards: [
      {
        title: 'Our Mission',
        content: 'To enhance virtue, develop competence, promote excellence, and inspire service in all academic levels of the institution.',
        type: 'text',
      },
      {
        title: 'Our Vision',
        content: 'We envision producing graduates who are values-driven, critical thinkers, service-oriented, and globally competitive.',
        type: 'text',
      },
      {
        title: 'Our Goals',
        type: 'ordered-list',
        items: [
          'Consistent pursuit of academic excellence.',
          'Faithful adherence to core values and virtue.',
          'Learning environment conducive to holistic formation.',
          'Continuous faculty development.',
          'Promotion of academic and cultural development.',
          'Partnership with the community in social service.',
          'Strict compliance with DepEd mandates.',
          'Conformity with K to 12 Standards & competencies.',
        ],
      },
      {
        title: 'Core Values',
        type: 'unordered-list',
        items: ['Integrity', 'Excellence', 'Service'],
      },
    ],
  },

  campuses: [
    {
      key:         'talisay',
      name:        'Talisay City Campus',
      badge:       'Main Campus',
      address:     'Lawaan 1, Talisay City, Cebu',
      description: 'Our main campus providing comprehensive education from Pre-Elementary to College level.',
      image:       'assets/talisay.jpg',
      features:    ['Complete education levels', 'Computer Laboratory', 'Science Laboratories', 'Clinic', 'Library'],
    },
    {
      key:         'carcar',
      name:        'Carcar City Campus',
      badge:       'Carcar Campus',
      address:     'Valladolid, Carcar City, Cebu',
      description: 'Serving the southern communities of Cebu with quality education and strong community ties.',
      image:       'assets/Carcar.jpg',
      features:    ['Complete education levels', 'Computer Laboratory', 'Science Laboratory', 'Clinic', 'College & Elementary Libraries'],
    },
    {
      key:         'bohol',
      name:        'Tagbilaran, Bohol Campus',
      badge:       'Bohol Campus',
      address:     'Tagbilaran, Bohol',
      description: 'Expanding our mission of excellence to the beautiful island of Bohol.',
      image:       'assets/Bohol.jpg',
      features:    ['Pre-Elementary to Junior High', 'Spacious Classrooms', 'Playground Facilities', 'Audio-Visual Room'],
    },
  ],

  programs: [
    {
      title:       'Pre-Elementary',
      age:         'Ages 3-5',
      description: 'Nurturing young minds through play-based learning and early childhood development.',
      features:    ['Nursery', 'Kindergarten', 'Preparatory'],
      highlight:   false,
    },
    {
      title:       'Elementary',
      age:         'Grades 1-6',
      description: 'Building strong foundations in academics, values, and character development.',
      features:    ['Core subjects mastery', 'Values education', 'Extracurricular activities'],
      highlight:   false,
    },
    {
      title:       'Junior High School',
      age:         'Grades 7-10',
      description: 'Preparing students for senior high through the comprehensive K-12 curriculum.',
      features:    ['Enhanced curriculum', 'Skills development', 'Career guidance'],
      highlight:   false,
    },
    {
      title:       'Senior High School',
      age:         'Grades 11-12',
      description: 'Specialized tracks preparing students for college and career readiness.',
      features:    ['General Academic Strand', 'Skills development', 'Specialized subjects'],
      highlight:   false,
    },
  ],

  requirements: [
    { icon: '📄', title: 'Birth Certificate',       desc: 'Original and photocopy (NSO/PSA issued)' },
    { icon: '📋', title: 'Report Card',              desc: 'Form 138 (previous school records)'      },
    { icon: '🎓', title: 'Good Moral Certificate',  desc: 'From previous school attended'            },
    { icon: '🪪', title: '2x2 ID Photos',           desc: 'Recent photos (white background)'         },
  ],

  steps: [
    { title: 'Submit Online Form',   desc: 'Fill out our online enrollment form or visit any campus registrar\'s office.' },
    { title: 'Submit Requirements',  desc: 'Provide all necessary documents to the registrar.'                             },
    { title: 'Pay Down Payment',     desc: 'Proceed to Accounting/Finance for assessment and initial payment.'             },
    { title: 'Registrar Approval',   desc: 'Receive your class schedule once enrollment is approved.'                      },
  ],

  contact: {
    campuses: [
      { name: 'Talisay City Campus (Main)', address: 'Lawaan 1, Talisay City, Cebu',  phone: '(032) XXX-XXXX', email: '' },
      { name: 'Carcar City Campus',         address: 'Valladolid, Carcar City, Cebu', phone: '(032) XXX-XXXX', email: '' },
      { name: 'Bohol Campus',               address: 'Tagbilaran, Bohol',             phone: '(032) XXX-XXXX', email: '' },
    ],
    officeHours: [
      'Monday - Friday: 8:00 AM - 5:00 PM',
      'Saturday: 8:00 AM - 12:00 PM',
      'Sunday: Closed',
    ],
  },

  faq: [
    {
      q: 'What are the tuition fees?',
      a: 'Tuition fees vary by campus and program. Please contact the Registrar\'s Office or visit any campus for detailed fee schedules.',
    },
    {
      q: 'Do you offer scholarships?',
      a: 'Yes, we offer various scholarships based on academic performance and financial need. Please inquire at the Admissions Office for eligibility criteria.',
    },
    {
      q: 'What extracurricular activities are available?',
      a: 'We offer sports, arts, music, and academic clubs. Each campus has its own set of activities — check with your campus for more details.',
    },
    {
      q: 'Can I enroll online?',
      a: 'Yes! Submit your form online, then proceed to any campus to complete requirements and payment.',
    },
  ],

  footer: {
    credit: 'Powered by ALMIRENE DX',
    social: [
      { icon: '📘', label: 'Facebook', href: '#' },
      { icon: '📧', label: 'Email',    href: '#' },
      { icon: '📞', label: 'Phone',    href: '#' },
    ],
  },

};

// ── Overlay admin-configured content on top of the defaults ────────
// Same shared key + layered-override pattern the Admin Portal itself
// uses (localStorage overrides > hardcoded defaults) — see
// AppConfigContext.jsx. Only fields the admin has actually set are
// applied; anything missing/blank falls back to DEFAULTS above.
function buildSiteData(defaults) {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem('almirene_website_content') || '{}');
  } catch (e) { saved = {}; }

  // Shallow-clone so we never mutate DEFAULTS itself
  const data = JSON.parse(JSON.stringify(defaults));

  const str = (v) => typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
  const arr = (v) => Array.isArray(v) && v.length > 0 ? v : null;

  if (str(saved.schoolName)) { data.school.name = saved.schoolName; }
  if (str(saved.motto))      { data.school.tagline = saved.motto; }
  if (str(saved.email))      { data.school.email = saved.email; }
  if (str(saved.phone))      { data.school.phone = saved.phone; }
  if (str(saved.schoolYear)) { data.school.schoolYear = saved.schoolYear; }
  if (str(saved.logoUrl))    { data.school.logoSrc = saved.logoUrl; data.school.navLogoSrc = saved.logoUrl; }

  const findCard = (title) => data.about.cards.find(c => c.title === title);
  if (str(saved.mission)) { const c = findCard('Our Mission'); if (c) c.content = saved.mission; }
  if (str(saved.vision))  { const c = findCard('Our Vision');  if (c) c.content = saved.vision; }
  if (arr(saved.goals))       { const c = findCard('Our Goals');  if (c) c.items = saved.goals; }
  if (arr(saved.coreValues))  { const c = findCard('Core Values'); if (c) c.items = saved.coreValues; }

  // programs/requirements/steps/faq shapes already match 1:1 with the
  // admin editor (see Settings.jsx School Info tab) — safe to swap wholesale.
  if (arr(saved.programs))     { data.programs = saved.programs; }
  if (arr(saved.requirements)) { data.requirements = saved.requirements; }
  if (arr(saved.steps))        { data.steps = saved.steps; }
  if (arr(saved.faq))          { data.faq = saved.faq; }

  return data;
}

const SITE_DATA = buildSiteData(DEFAULTS);
