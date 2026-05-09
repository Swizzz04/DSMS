export const DEFAULT_BASIC_ED_SUBJECTS = {
  // Pre-Elementary (no composite subjects)
  'Nursery':       ['Language/Reading Readiness', 'Math Readiness', 'Values Education', 'Music, Arts, PE & Health'],
  'Kindergarten':  ['Mother Tongue', 'Language/Reading Readiness', 'Math Readiness', 'Values Education', 'Music, Arts, PE & Health'],
  'Preparatory':   ['Mother Tongue', 'Language/Reading Readiness', 'Math Readiness', 'Values Education', 'Music, Arts, PE & Health'],
  // Elementary (MAPEH expanded into Music & Arts + PE & Health; HELE expanded with Computer)
  'Grade 1':       ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'Mother Tongue', 'Music & Arts', 'PE & Health', 'Edukasyon sa Pagpapakatao (EsP)', 'HELE', 'Computer'],
  'Grade 2':       ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'Mother Tongue', 'Music & Arts', 'PE & Health', 'EsP', 'HELE', 'Computer'],
  'Grade 3':       ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'Mother Tongue', 'Music & Arts', 'PE & Health', 'EsP', 'HELE', 'Computer'],
  'Grade 4':       ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'Music & Arts', 'PE & Health', 'EsP', 'HELE', 'Computer'],
  'Grade 5':       ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'Music & Arts', 'PE & Health', 'EsP', 'HELE', 'Computer'],
  'Grade 6':       ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'Music & Arts', 'PE & Health', 'EsP', 'HELE', 'Computer'],
  // Junior High (MAPEH expanded into Music & Arts + PE & Health; TLE expanded with Computer)
  'Grade 7':       ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'Music & Arts', 'PE & Health', 'EsP', 'TLE', 'Computer'],
  'Grade 8':       ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'Music & Arts', 'PE & Health', 'EsP', 'TLE', 'Computer'],
  'Grade 9':       ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'Music & Arts', 'PE & Health', 'EsP', 'TLE', 'Computer'],
  'Grade 10':      ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'Music & Arts', 'PE & Health', 'EsP', 'TLE', 'Computer'],
  // Senior High (no MAPEH/TLE composites — subjects are standalone)
  'Grade 11':      ['Core English', 'Core Mathematics', 'Contemporary Philippine Arts', 'Physical Education', 'Personal Development', 'Earth and Life Science', 'Understanding Culture, Society and Politics', 'Empowerment Technology', 'Oral Communication', 'Reading and Writing', 'Komunikasyon at Pananaliksik'],
  'Grade 12':      ['Core English', 'Core Mathematics', 'Physical Education', 'Inquiries, Investigations and Immersion', 'Philippine Politics and Governance', 'Media and Information Literacy', 'Research/Capstone Project'],
}

export const DEFAULT_COLLEGE_SUBJECTS = {
  'BS Criminology': {
    '1st Year': {
      '1st': [
        'Introduction to Criminology',
        'Philippine Criminal Justice System',
        'Criminal Law 1',
        'Law Enforcement Administration',
        'Sociology of Crimes and Ethics',
        'Physical Fitness and Self-Defense 1',
        'English Communication Arts',
        'Mathematics in the Modern World',
      ],
      '2nd': [
        'Criminal Law 2',
        'Crime Detection and Investigation 1',
        'Criminalistics 1 (Dactyloscopy)',
        'Human Behavior and Crisis Management',
        'Physical Fitness and Self-Defense 2',
        'Purposive Communication',
        'Readings in Philippine History',
      ],
    },
    '2nd Year': {
      '1st': [
        'Crime Detection and Investigation 2',
        'Criminalistics 2 (questioned documents)',
        'Forensic Photography',
        'Juvenile Delinquency and Juvenile Justice',
        'Police Organization and Administration',
        'Traffic Management and Accident Investigation',
        'Science, Technology and Society',
        'Art Appreciation',
      ],
      '2nd': [
        'Criminalistics 3 (Firearms & Explosives)',
        'Correctional Administration',
        'Ethics and Human Rights',
        'Public Safety Act and Other Related Laws',
        'Intelligence and Counter-Intelligence',
        'The Contemporary World',
        'Gender and Society',
      ],
    },
    '3rd Year': {
      '1st': [
        'Criminalistics 4 (Polygraphy)',
        'Cyber Crime Investigation',
        'Drug Education and Vice Control',
        'Private Security Administration',
        'Practical Shooting',
        'Rizal and Other Heroes',
        'Research Methods in Criminology',
      ],
      '2nd': [
        'White Collar and Economic Crimes',
        'Penology and Victimology',
        'Special Crimes Investigation',
        'Fire Technology and Arson Investigation',
        'Legal Medicine, Psychiatry and Criminalistics',
        'Research in Criminology (Thesis 1)',
      ],
    },
    '4th Year': {
      '1st': [
        'Seminar in Criminology',
        'Research in Criminology (Thesis 2)',
        'On-The-Job Training / Practicum 1',
        'Criminal Procedure and Court Testimonies',
        'Review for Board Examination 1',
      ],
      '2nd': [
        'On-The-Job Training / Practicum 2',
        'Review for Board Examination 2',
        'Seminar on Current Issues in Criminology',
      ],
    },
  },
  'BS Nursing': {
    '1st Year': {
      '1st': ['Anatomy and Physiology', 'Biochemistry', 'Nutrition and Diet Therapy', 'Fundamentals of Nursing', 'English for Academic Purposes', 'Mathematics in the Modern World'],
      '2nd': ['Microbiology and Parasitology', 'Pharmacology 1', 'Health Assessment', 'Care of Mother and Child 1', 'Purposive Communication'],
    },
    '2nd Year': {
      '1st': ['Pharmacology 2', 'Medical-Surgical Nursing 1', 'Care of Mother and Child 2', 'Psychiatric Nursing', 'Community Health Nursing 1'],
      '2nd': ['Medical-Surgical Nursing 2', 'Pediatric Nursing', 'Communicable Disease Nursing', 'Community Health Nursing 2', 'Research in Nursing 1'],
    },
    '3rd Year': {
      '1st': ['Medical-Surgical Nursing 3', 'Operating Room Nursing', 'Gerontological Nursing', 'Nursing Informatics', 'Research in Nursing 2'],
      '2nd': ['Related Learning Experience (RLE) 1', 'Leadership and Management in Nursing', 'Legal and Ethical Aspects of Nursing'],
    },
    '4th Year': {
      '1st': ['Related Learning Experience (RLE) 2', 'Community Health Nursing 3', 'Review for Nursing Board 1'],
      '2nd': ['Related Learning Experience (RLE) 3', 'Review for Nursing Board 2', 'Capstone Project'],
    },
  },
  'BS HRM': {
    '1st Year': {
      '1st': ['Introduction to Hospitality Industry', 'Food and Beverage Service 1', 'Culinary Arts 1', 'Hotel Operations 1', 'English Communication', 'Mathematics in the Modern World'],
      '2nd': ['Food and Beverage Service 2', 'Culinary Arts 2', 'Front Office Operations', 'Housekeeping Operations', 'Purposive Communication'],
    },
    '2nd Year': {
      '1st': ['Food and Beverage Service 3', 'Culinary Arts 3', 'Events Management 1', 'Tourism and Travel Management', 'Accounting for HRM'],
      '2nd': ['Bar and Beverage Management', 'Events Management 2', 'Catering and Banquet Operations', 'Human Resource Management', 'Research Methods'],
    },
    '3rd Year': {
      '1st': ['Strategic Hospitality Management', 'Revenue Management', 'Customer Relations Management', 'Safety and Sanitation', 'Research in HRM 1'],
      '2nd': ['Practicum 1 (Hotel/Restaurant)', 'Quality Service Management', 'Entrepreneurship in HRM', 'Research in HRM 2'],
    },
    '4th Year': {
      '1st': ['Practicum 2', 'Seminar in HRM', 'Capstone Project 1'],
      '2nd': ['Practicum 3', 'Capstone Project 2', 'Review and Preparation for Industry'],
    },
  },
  'BS Tourism': {
    '1st Year': {
      '1st': ['Introduction to Tourism', 'Tourism Geography', 'Tour Guiding', 'Travel Agency Operations 1', 'English for Tourism', 'Mathematics in the Modern World'],
      '2nd': ['Travel Agency Operations 2', 'Tourism Marketing', 'Hotel and Restaurant Operations', 'Cultural Heritage Tourism', 'Purposive Communication'],
    },
    '2nd Year': {
      '1st': ['Ecotourism', 'Events and Meetings Management', 'Airline Ticketing and Reservation', 'Tourism Economics', 'Research Methods'],
      '2nd': ['Adventure and Sports Tourism', 'Tourism Product Development', 'Tourism Policy and Planning', 'Accounting for Tourism', 'Research in Tourism 1'],
    },
    '3rd Year': {
      '1st': ['Medical and Wellness Tourism', 'Tourism Law and Ethics', 'Risk Management in Tourism', 'Practicum Preparation', 'Research in Tourism 2'],
      '2nd': ['Practicum 1', 'Sustainable Tourism', 'Entrepreneurship in Tourism'],
    },
    '4th Year': {
      '1st': ['Practicum 2', 'Seminar in Tourism', 'Capstone Project 1'],
      '2nd': ['Practicum 3', 'Capstone Project 2', 'Industry Immersion'],
    },
  },
}