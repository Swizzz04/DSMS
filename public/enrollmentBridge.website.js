/**
 * enrollmentBridge.website.js
 * ─────────────────────────────────────────────────────────────────
 * Browser-ready version of the enrollment bridge for the school
 * website (plain HTML, no bundler).
 *
 * Include BEFORE enrollment.js in enrollment.html:
 *   <script src="enrollmentBridge.website.js"></script>
 *   <script src="enrollment.js"></script>
 *
 * Exposes: window.CSHC_Bridge.submitToAdminPortal(formData)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'cshc_submissions';
  const COUNTER_KEY = 'cshc_ref_counter';

  // ── Campus name mapping ────────────────────────────────────────
  var CAMPUS_MAP = {
    talisay: 'Talisay City Campus',
    carcar:  'Carcar City Campus',
    bohol:   'Bohol Campus',
  };

  // ── Grade level mapping ────────────────────────────────────────
  var GRADE_MAP = {
    nursery:      'Nursery',
    kindergarten: 'Kindergarten',
    preparatory:  'Preparatory',
    grade1:  'Grade 1',  grade2:  'Grade 2',  grade3:  'Grade 3',
    grade4:  'Grade 4',  grade5:  'Grade 5',  grade6:  'Grade 6',
    grade7:  'Grade 7',  grade8:  'Grade 8',  grade9:  'Grade 9',
    grade10: 'Grade 10', grade11: 'Grade 11', grade12: 'Grade 12',
    bsnursing1: 'BS Nursing - 1st Year', bsnursing2: 'BS Nursing - 2nd Year',
    bsnursing3: 'BS Nursing - 3rd Year', bsnursing4: 'BS Nursing - 4th Year',
    bshrm1: 'BS HRM - 1st Year',        bshrm2: 'BS HRM - 2nd Year',
    bshrm3: 'BS HRM - 3rd Year',        bshrm4: 'BS HRM - 4th Year',
    bstourism1: 'BS Tourism - 1st Year', bstourism2: 'BS Tourism - 2nd Year',
    bstourism3: 'BS Tourism - 3rd Year', bstourism4: 'BS Tourism - 4th Year',
    bscrim1: 'BS Criminology - 1st Year', bscrim2: 'BS Criminology - 2nd Year',
    bscrim3: 'BS Criminology - 3rd Year', bscrim4: 'BS Criminology - 4th Year',
  };

  var TYPE_MAP = {
    new:        'New',
    transferee: 'Transferee',
    returnee:   'Returnee',
  };

  // ── Generate reference number ──────────────────────────────────
  function generateRefNum() {
    var year    = new Date().getFullYear();
    var stored  = localStorage.getItem(COUNTER_KEY);
    var counter = stored ? parseInt(stored, 10) + 1 : 1000;
    localStorage.setItem(COUNTER_KEY, counter.toString());
    return 'CSHC-' + year + '-W' + String(counter).padStart(4, '0');
  }

  // ── Calculate age from birthDate string ───────────────────────
  function calcAge(birthDateStr) {
    if (!birthDateStr) return '';
    var bd    = new Date(birthDateStr);
    var today = new Date();
    var age   = today.getFullYear() - bd.getFullYear();
    if (today.getMonth() < bd.getMonth() ||
       (today.getMonth() === bd.getMonth() && today.getDate() < bd.getDate())) {
      age--;
    }
    return age >= 0 ? String(age) : '';
  }

  // ── Capitalize first letter ────────────────────────────────────
  function cap(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ── Normalize raw form data → portal format ────────────────────
  function normalize(raw, refNum) {
    return {
      id:              refNum,
      referenceNumber: refNum,
      status:          'pending',
      source:          'website',
      submittedDate:   new Date().toISOString(),

      student: {
        firstName:     raw.firstName     || '',
        middleName:    raw.middleName    || '',
        lastName:      raw.lastName      || '',
        birthDate:     raw.birthDate     || '',
        age:           calcAge(raw.birthDate),
        placeOfBirth:  raw.birthPlace    || '',
        gender:        cap(raw.gender),
        civilStatus:   cap(raw.civilStatus),
        religion:      raw.religion      || '',
        nationality:   cap(raw.nationality),
        address:       raw.address       || '',
        email:         raw.email         || '',
        contactNumber: raw.contactNumber || '',
      },

      enrollment: {
        campus:      CAMPUS_MAP[raw.campus]         || raw.campus      || '',
        gradeLevel:  GRADE_MAP[raw.gradeLevel]       || raw.gradeLevel  || '',
        studentType: TYPE_MAP[raw.studentType]       || raw.studentType || '',
        schoolYear:  raw.schoolYear                  || '2025-2026',
      },

      father: {
        name:          raw.fatherName       || '',
        occupation:    raw.fatherOccupation || '',
        contactNumber: raw.fatherContact    || '',
      },

      mother: {
        name:          raw.motherName       || '',
        occupation:    raw.motherOccupation || '',
        contactNumber: raw.motherContact    || '',
      },

      guardian: {
        name:          raw.guardianName     || '',
        relationship:  raw.guardianRelation || '',
        contactNumber: raw.guardianContact  || '',
      },

      previousSchool: {
        name:       raw.lastSchool        || raw.elementarySchool || '',
        address:    raw.schoolAddress     || raw.elementaryAddress || '',
        lastGrade:  raw.lastGrade         || '',
        schoolYear: raw.lastSchoolYear    || '',
        elementary: raw.elementarySchool ? {
          name: raw.elementarySchool || '', address: raw.elementaryAddress || '', year: raw.elementaryYear || ''
        } : null,
        juniorHigh: raw.juniorHighSchool ? {
          name: raw.juniorHighSchool || '', address: raw.juniorHighAddress || '', year: raw.juniorHighYear || ''
        } : null,
        seniorHigh: raw.seniorHighSchool ? {
          name: raw.seniorHighSchool || '', address: raw.seniorHighAddress || '', year: raw.seniorHighYear || ''
        } : null,
        lastCollege: raw.lastCollegeSchool ? {
          name: raw.lastCollegeSchool || '', address: raw.lastCollegeAddress || '', year: raw.lastCollegeYear || ''
        } : null,
      },
    };
  }

  // ── Load existing submissions ──────────────────────────────────
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  // ── Public API ─────────────────────────────────────────────────

  /**
   * submitToAdminPortal(rawFormData)
   * Called by enrollment.js after form submit.
   * @param {Object} rawFormData — Object.fromEntries(new FormData(form))
   * @returns {{ success: boolean, referenceNumber: string|null }}
   */
  function submitToAdminPortal(rawFormData) {
    try {
      var refNum      = generateRefNum();
      var normalized  = normalize(rawFormData, refNum);
      var submissions = load();
      submissions.push(normalized);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));

      // Notify admin portal if open in same browser
      try {
        window.dispatchEvent(new CustomEvent('cshc_new_submission', {
          detail: { referenceNumber: refNum }
        }));
      } catch (e) { /* ignore */ }

      console.log('[CSHC Bridge] Enrollment saved:', refNum);
      return { success: true, referenceNumber: refNum };
    } catch (err) {
      console.error('[CSHC Bridge] Save failed:', err);
      return { success: false, referenceNumber: null };
    }
  }

  /**
   * getPendingCount()
   * Returns the number of pending (unreviewed) submissions.
   */
  function getPendingCount() {
    return load().filter(function(s) { return s.status === 'pending'; }).length;
  }

  // ── Expose on window ───────────────────────────────────────────
  window.CSHC_Bridge = {
    submitToAdminPortal: submitToAdminPortal,
    getPendingCount:     getPendingCount,
  };

  console.log('[CSHC Bridge] Ready. Pending submissions:', getPendingCount());

})();
