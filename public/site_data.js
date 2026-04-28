// ============================================================
// CSHC WEBSITE — SINGLE SOURCE OF TRUTH
// All content lives here. To add/edit anything on the website,
// just update this file. No HTML or CSS changes needed.
// ============================================================

const SITE_DATA = {

  school: {
    name:     'Cebu Sacred Heart College, Inc.',
    nameShort:'CSHC',
    tagline:  'Where Children Grow In Love and Knowledge.',
    founded:  '2005',
    email:    'info@cshc.edu.ph',
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
    title:    'About Cebu Sacred Heart College',
    subtitle: 'Nurturing minds and hearts since 2005 — building Christ-centered, globally competitive graduates.',
    cards: [
      {
        title: 'Our Mission',
        content: 'To enhance virtue, develop competence, promote excellence, and inspire service in all academic levels of the institution.',
        type: 'text',
      },
      {
        title: 'Our Vision',
        content: 'CSHC envisions to produce graduates who are Christ-centered, critical thinkers, service-oriented, and globally competitive.',
        type: 'text',
      },
      {
        title: 'Our Goals',
        type: 'ordered-list',
        items: [
          'Consistent pursuit of academic excellence.',
          'Faithful adherence to Christian values and virtue.',
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
        items: ['Integrity', 'Christ-centered', 'Excellence'],
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
    {
      title:       'College',
      age:         '4-Year Program',
      description: 'BS in Criminology — training future law enforcement professionals.',
      features:    ['Board exam preparation', 'Practical training', 'Professional instructors'],
      highlight:   true,
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
      { name: 'Talisay City Campus (Main)', address: 'Lawaan 1, Talisay City, Cebu',  phone: '(032) XXX-XXXX', email: 'talisaysacredheart@gmail.com' },
      { name: 'Carcar City Campus',         address: 'Valladolid, Carcar City, Cebu', phone: '(032) XXX-XXXX', email: 'carcarsacredheart@gmail.com'  },
      { name: 'Bohol Campus',               address: 'Tagbilaran, Bohol',             phone: '(032) XXX-XXXX', email: 'boholsacredheart@gmail.com'   },
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
    {
      q: 'What programs are offered at each campus?',
      a: 'All campuses offer Basic Education (Pre-Elem to SHS). College programs are at Talisay (BS Nursing, BS Tourism, BS Hospitality Management) and Carcar (BS Criminology). Bohol offers Pre-Elementary to Junior High.',
    },
  ],

  footer: {
    credit: 'Developed by Alvin Gonzales',
    social: [
      { icon: '📘', label: 'Facebook', href: '#' },
      { icon: '📧', label: 'Email',    href: '#' },
      { icon: '📞', label: 'Phone',    href: '#' },
    ],
  },

};