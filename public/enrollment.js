// ============================================================
// SECURITY MODULE
// ============================================================

const CSHC_Security = (() => {

  // ── 1. XSS Sanitization ─────────────────────────────────
  // Escapes all dangerous HTML characters before storing or displaying
  function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .trim();
  }

  // ── 2. Suspicious Content Detection ─────────────────────
  // Blocks script injection, SQL injection, and javascript: URLs
  const DANGEROUS_PATTERNS = [
    /<script/i, /javascript:/i, /on\w+\s*=/i,
    /SELECT\s+.*FROM/i, /INSERT\s+INTO/i, /DROP\s+TABLE/i,
    /UNION\s+SELECT/i, /<iframe/i, /eval\s*\(/i,
    /document\.cookie/i, /window\.location/i,
  ];

  function isSuspicious(value) {
    return DANGEROUS_PATTERNS.some(p => p.test(value));
  }

  // ── 3. Rate Limiting ─────────────────────────────────────
  // Max 3 submissions per 10 minutes per browser session
  const RATE_KEY    = 'cshc_enr_rate';
  const MAX_SUBS    = 3;
  const WINDOW_MS   = 10 * 60 * 1000; // 10 minutes

  function checkRateLimit() {
    try {
      const raw  = sessionStorage.getItem(RATE_KEY);
      const data = raw ? JSON.parse(raw) : { count: 0, windowStart: Date.now() };
      const now  = Date.now();

      // Reset window if expired
      if (now - data.windowStart > WINDOW_MS) {
        data.count = 0;
        data.windowStart = now;
      }

      if (data.count >= MAX_SUBS) {
        const remaining = Math.ceil((WINDOW_MS - (now - data.windowStart)) / 60000);
        return { allowed: false, message: `Too many submissions. Please wait ${remaining} minute(s) before trying again.` };
      }

      return { allowed: true, data };
    } catch {
      return { allowed: true, data: { count: 0, windowStart: Date.now() } };
    }
  }

  function recordSubmission() {
    try {
      const raw  = sessionStorage.getItem(RATE_KEY);
      const data = raw ? JSON.parse(raw) : { count: 0, windowStart: Date.now() };
      data.count++;
      sessionStorage.setItem(RATE_KEY, JSON.stringify(data));
    } catch {}
  }

  // ── 4. Duplicate Submission Prevention ──────────────────
  // Prevents double-click or accidental re-submission
  let _submitted = false;
  function markSubmitted() { _submitted = true; }
  function isAlreadySubmitted() { return _submitted; }

  // ── 5. Form Token (CSRF-like) ────────────────────────────
  // Generates a unique session token to verify form origin
  function generateToken() {
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('cshc_form_token', token);
    return token;
  }

  function validateToken(token) {
    return token === sessionStorage.getItem('cshc_form_token');
  }

  // ── 6. Age Validation ────────────────────────────────────
  function validateAge(birthDateStr) {
    if (!birthDateStr) return { valid: false, message: 'Date of birth is required.' };
    const bd    = new Date(birthDateStr);
    const today = new Date();
    let age     = today.getFullYear() - bd.getFullYear();
    if (today.getMonth() < bd.getMonth() || (today.getMonth() === bd.getMonth() && today.getDate() < bd.getDate())) age--;
    if (age < 2)   return { valid: false, message: 'Age must be at least 2 years old.' };
    if (age > 80)  return { valid: false, message: 'Please enter a valid date of birth.' };
    if (bd > today) return { valid: false, message: 'Date of birth cannot be in the future.' };
    return { valid: true };
  }

  // ── 7. Input Sanitization for all fields ────────────────
  function sanitizeFormData(data) {
    const clean = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        if (isSuspicious(value)) {
          throw new Error(`Suspicious content detected in field: ${key}`);
        }
        clean[key] = sanitize(value);
      } else {
        clean[key] = value;
      }
    }
    return clean;
  }

  // ── 8. Honeypot Check ────────────────────────────────────
  // Bots usually fill hidden fields; humans don't see them
  function checkHoneypot() {
    const honeypot = document.getElementById('cshc_hp_field');
    return !honeypot || honeypot.value === '';
  }

  // ── Public API ────────────────────────────────────────────
  return {
    sanitize,
    isSuspicious,
    checkRateLimit,
    recordSubmission,
    markSubmitted,
    isAlreadySubmitted,
    generateToken,
    validateToken,
    validateAge,
    sanitizeFormData,
    checkHoneypot,
  };
})();

// Generate form token on page load
const _formToken = CSHC_Security.generateToken();

document.addEventListener('DOMContentLoaded', function() {
    
    const enrollmentForm = document.getElementById('enrollmentForm');
    const campusSelect = document.getElementById('campus');
    const gradeLevelSelect = document.getElementById('gradeLevel');
    const birthDateInput = document.getElementById('birthDate');
    const ageInput = document.getElementById('age');
    const successMessage = document.getElementById('successMessage');
    const referenceNumber = document.getElementById('referenceNumber');
    
    // Multi-step variables
    let currentStep = 1;
    const totalSteps = 5;
    
    // ============================================
    // CAMPUS PROGRAMS DATA
    // ============================================
   
    const campusPrograms = {
        talisay: {
            name: "Talisay City Campus (Main)",
            programs: [
                { group: "Pre-Elementary", options: [
                    { value: "nursery", label: "Nursery" },
                    { value: "kindergarten", label: "Kindergarten" },
                    { value: "preparatory", label: "Preparatory" }
                ]},
                { group: "Elementary", options: [
                    { value: "grade1", label: "Grade 1" },
                    { value: "grade2", label: "Grade 2" },
                    { value: "grade3", label: "Grade 3" },
                    { value: "grade4", label: "Grade 4" },
                    { value: "grade5", label: "Grade 5" },
                    { value: "grade6", label: "Grade 6" }
                ]},
                { group: "Junior High School", options: [
                    { value: "grade7", label: "Grade 7" },
                    { value: "grade8", label: "Grade 8" },
                    { value: "grade9", label: "Grade 9" },
                    { value: "grade10", label: "Grade 10" }
                ]},
                { group: "Senior High School", options: [
                    { value: "grade11", label: "Grade 11" },
                    { value: "grade12", label: "Grade 12" }
                ]},
                { group: "College", options: [
                    { value: "bsnursing1", label: "BS Nursing - 1st Year" },
                    { value: "bsnursing2", label: "BS Nursing - 2nd Year" },
                    { value: "bsnursing3", label: "BS Nursing - 3rd Year" },
                    { value: "bsnursing4", label: "BS Nursing - 4th Year" }
                ]}
            ]
        },
        carcar: {
            name: "Carcar City Campus",
            programs: [
                { group: "Pre-Elementary", options: [
                    { value: "nursery", label: "Nursery" },
                    { value: "kindergarten", label: "Kindergarten" },
                    { value: "preparatory", label: "Preparatory" }
                ]},
                { group: "Elementary", options: [
                    { value: "grade1", label: "Grade 1" },
                    { value: "grade2", label: "Grade 2" },
                    { value: "grade3", label: "Grade 3" },
                    { value: "grade4", label: "Grade 4" },
                    { value: "grade5", label: "Grade 5" },
                    { value: "grade6", label: "Grade 6" }
                ]},
                { group: "Junior High School", options: [
                    { value: "grade7", label: "Grade 7" },
                    { value: "grade8", label: "Grade 8" },
                    { value: "grade9", label: "Grade 9" },
                    { value: "grade10", label: "Grade 10" }
                ]},
                { group: "Senior High School", options: [
                    { value: "grade11", label: "Grade 11" },
                    { value: "grade12", label: "Grade 12" }
                ]},
                { group: "College", options: [
                    { value: "bscrim1", label: "BS Criminology - 1st Year" },
                    { value: "bscrim2", label: "BS Criminology - 2nd Year" },
                    { value: "bscrim3", label: "BS Criminology - 3rd Year" },
                    { value: "bscrim4", label: "BS Criminology - 4th Year" }
                ]}
            ]
        },
        bohol: {
            name: "Tagbilaran, Bohol Campus",
            programs: [
                { group: "Pre-Elementary", options: [
                    { value: "nursery", label: "Nursery" },
                    { value: "kindergarten", label: "Kindergarten" },
                    { value: "preparatory", label: "Preparatory" }
                ]},
                { group: "Elementary", options: [
                    { value: "grade1", label: "Grade 1" },
                    { value: "grade2", label: "Grade 2" },
                    { value: "grade3", label: "Grade 3" },
                    { value: "grade4", label: "Grade 4" },
                    { value: "grade5", label: "Grade 5" },
                    { value: "grade6", label: "Grade 6" }
                ]},
                { group: "Junior High School", options: [
                    { value: "grade7", label: "Grade 7" },
                    { value: "grade8", label: "Grade 8" },
                    { value: "grade9", label: "Grade 9" },
                    { value: "grade10", label: "Grade 10" }
                ]},
                { group: "Senior High School", options: [
                    { value: "grade11", label: "Grade 11" },
                    { value: "grade12", label: "Grade 12" }
                ]}
            ]
        }
    };

// ============================================
// SMART NAVBAR - AUTO HIDE ON SCROLL DOWN
// ============================================

let lastScrollTop = 0;
let isScrolling = false;
const navbar = document.querySelector('nav');
const scrollThreshold = 100; // Pixels scrolled before hiding navbar

if (navbar) {
    window.addEventListener('scroll', function() {
        if (!isScrolling) {
            window.requestAnimationFrame(function() {
                handleNavbarScroll();
                isScrolling = false;
            });
            isScrolling = true;
        }
    });
}

function handleNavbarScroll() {
    const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // At the very top - always show navbar
    if (currentScrollTop <= 50) {
        navbar.classList.remove('nav-hidden', 'scrolled');
        navbar.classList.add('nav-visible');
        lastScrollTop = currentScrollTop;
        return;
    }
    
    // Add shadow effect when scrolled
    if (currentScrollTop > 50) {
        navbar.classList.add('scrolled');
    }
    
    // Scrolling down - hide navbar
    if (currentScrollTop > lastScrollTop && currentScrollTop > scrollThreshold) {
        navbar.classList.remove('nav-visible');
        navbar.classList.add('nav-hidden');
    } 
    // Scrolling up - show navbar
    else if (currentScrollTop < lastScrollTop) {
        navbar.classList.remove('nav-hidden');
        navbar.classList.add('nav-visible');
    }
    
    lastScrollTop = currentScrollTop <= 0 ? 0 : currentScrollTop;
}

// ============================================
// NAVBAR APPEARS ON HOVER NEAR TOP
// ============================================

let hoverTimeout;

document.addEventListener('mousemove', function(e) {
    // If mouse is near the top of the screen (within 100px)
    if (e.clientY < 100) {
        clearTimeout(hoverTimeout);
        
        // Show navbar
        if (navbar) {
            navbar.classList.remove('nav-hidden');
            navbar.classList.add('nav-visible');
        }
        
        // Hide again after 3 seconds if not at top of page
        hoverTimeout = setTimeout(function() {
            const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
            if (currentScrollTop > scrollThreshold) {
                navbar.classList.remove('nav-visible');
                navbar.classList.add('nav-hidden');
            }
        }, 3000);
    }
});

// Show navbar when hovering over it directly
if (navbar) {
    navbar.addEventListener('mouseenter', function() {
        clearTimeout(hoverTimeout);
        this.classList.remove('nav-hidden');
        this.classList.add('nav-visible');
    });
    
    navbar.addEventListener('mouseleave', function() {
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Hide again if scrolled down
        if (currentScrollTop > scrollThreshold) {
            hoverTimeout = setTimeout(() => {
                this.classList.remove('nav-visible');
                this.classList.add('nav-hidden');
            }, 1000);
        }
    });
}




// ============================================
// DYNAMIC SCHOOL FORM ( Detailed)
// ============================================

const simpleSchoolForm = document.getElementById('simpleSchoolForm');
const detailedEducationForm = document.getElementById('detailedEducationForm');
const step4Title = document.getElementById('step4Title');

// Function to update school form based on grade level
function updateSchoolForm() {
    const selectedGradeLevel = gradeLevelSelect.value;
    
    // Check if college level is selected
    const isCollege = selectedGradeLevel.includes('bsnursing') || 
                      selectedGradeLevel.includes('bscrim');
    
    // Show/hide semester field for college programs
    const semesterGroup  = document.getElementById('semesterGroup')
    const semesterSelect = document.getElementById('semester')
    const shiftyOption   = document.querySelector('option[value="shifty"]')
    const typeHint       = document.getElementById('studentTypeHint')

    if (isCollege) {
        // Show semester selector
        if (semesterGroup)  { semesterGroup.style.display = 'block'; semesterSelect.required = true }
        // Show Shifty option
        if (shiftyOption)   shiftyOption.style.display = 'block'
    } else {
        // Hide semester selector
        if (semesterGroup)  { semesterGroup.style.display = 'none'; semesterSelect.required = false; semesterSelect.value = '' }
        // Hide Shifty option — reset if selected
        if (shiftyOption)   shiftyOption.style.display = 'none'
        const typeEl = document.getElementById('studentType')
        if (typeEl && typeEl.value === 'shifty') typeEl.value = ''
    }

    if (isCollege) {
        // Show detailed education history for college students
        simpleSchoolForm.style.display = 'none';
        detailedEducationForm.style.display = 'block';
        step4Title.textContent = 'Preliminary Education History';
        
        // Make detailed fields required
        document.getElementById('elementarySchool').setAttribute('required', 'required');
        document.getElementById('juniorHighSchool').setAttribute('required', 'required');
        document.getElementById('seniorHighSchool').setAttribute('required', 'required');
        
        // Remove required from simple form
        document.getElementById('lastSchool').removeAttribute('required');
        
    } else {
        // Show simple form for non-college students
        simpleSchoolForm.style.display = 'block';
        detailedEducationForm.style.display = 'none';
        step4Title.textContent = 'Previous School Information';
        
        // Make simple form field required
        document.getElementById('lastSchool').setAttribute('required', 'required');
        
        // Remove required from detailed form
        document.getElementById('elementarySchool').removeAttribute('required');
        document.getElementById('juniorHighSchool').removeAttribute('required');
        document.getElementById('seniorHighSchool').removeAttribute('required');
    }
}

// Listen for grade level changes
if (gradeLevelSelect) {
    gradeLevelSelect.addEventListener('change', function() {
        updateSchoolForm();
    });
}

// Also check when navigating to step 4
window.addEventListener('DOMContentLoaded', function() {
    // Check initial state
    if (gradeLevelSelect && gradeLevelSelect.value) {
        updateSchoolForm();
    }
});

// Update form when moving to step 4
const originalUpdateStep = updateStep;
window.updateStep = function() {
    originalUpdateStep();
    
    // If moving to step 4, update the form
    if (currentStep === 4) {
        updateSchoolForm();
    }
};

    
    // ============================================
    // DYNAMIC GRADE LEVEL UPDATE
    // ============================================

function updateGradeLevels() {
    const selectedCampus = campusSelect.value;
    
    // Clear current options
    gradeLevelSelect.innerHTML = '<option value=""></option>';
    
    if (!selectedCampus) {
        gradeLevelSelect.disabled = true;
        return;
    }
    
    // Enable grade level dropdown
    gradeLevelSelect.disabled = false;
    
    // Get programs for selected campus
    const programs = campusPrograms[selectedCampus].programs;
    
    // Populate grade levels
    programs.forEach(programGroup => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = programGroup.group;
        
        programGroup.options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            optgroup.appendChild(optionElement);
        });
        
        gradeLevelSelect.appendChild(optgroup);
    });
}

// ✅ ONE event listener for campus change
campusSelect.addEventListener('change', function() {
    updateGradeLevels();
    
    // Force grade level label to float when campus is selected
    if (this.value) {
        const gradeLevelContainer = gradeLevelSelect.closest('.floating-input');
        const gradeLevelLabel = gradeLevelContainer ? gradeLevelContainer.querySelector('label') : null;
        
        if (gradeLevelLabel) {
            gradeLevelLabel.style.top = '0';
            gradeLevelLabel.style.left = '0.8rem';
            gradeLevelLabel.style.fontSize = '0.75rem';
            gradeLevelLabel.style.color = 'var(--primary-red)';
            gradeLevelLabel.style.fontWeight = '600';
        }
        
        // Focus on grade level to prompt user
        setTimeout(() => {
            gradeLevelSelect.focus();
        }, 200);
    }
});

// ✅ ONE disabled initialization (ONLY ONE TIME)
gradeLevelSelect.disabled = true;

// ✅ Make grade level label float when option is selected
gradeLevelSelect.addEventListener('change', function() {
    const container = this.closest('.floating-input');
    const label = container ? container.querySelector('label') : null;
    
    if (this.value && label) {
        label.style.top = '0';
        label.style.left = '0.8rem';
        label.style.fontSize = '0.75rem';
        label.style.color = 'var(--primary-red)';
        label.style.fontWeight = '600';
    }
});

    
    // ============================================
    // AUTO-CALCULATE AGE
    // ============================================
    
    birthDateInput.addEventListener('change', function() {
        const birthDate = new Date(this.value);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        ageInput.value = age >= 0 ? age : '';
    });


	// ============================================
	// INPUT VALIDATIONS & RESTRICTIONS
	// ============================================

	// ✅ NO MIDDLE NAME CHECKBOX
	const noMiddleNameCheckbox = document.getElementById('noMiddleName');
	const middleNameInput = document.getElementById('middleName');

	if (noMiddleNameCheckbox && middleNameInput) {
    	noMiddleNameCheckbox.addEventListener('change', function() {
       	 if (this.checked) {
            middleNameInput.value = 'N/A';
            middleNameInput.disabled = true;
            middleNameInput.style.backgroundColor = 'var(--off-white)';
       	 } else {
            middleNameInput.value = '';
            middleNameInput.disabled = false;
            middleNameInput.style.backgroundColor = 'var(--white)';
       	 }
    	});
	}

	// ✅ CONTACT NUMBER - ONLY NUMBERS, MAX 11 DIGITS
	const contactNumberInput = document.getElementById('contactNumber');

	if (contactNumberInput) {
   	 contactNumberInput.addEventListener('input', function(e) {
        // Remove any non-digit characters
        let value = this.value.replace(/\D/g, '');
        
        // Limit to 11 digits
        if (value.length > 11) {
            value = value.slice(0, 11);
        	}
        
        	this.value = value;
   		 });
    
   	 // Prevent non-numeric input on keypress
    	contactNumberInput.addEventListener('keypress', function(e) {
        const char = String.fromCharCode(e.which);
        if (!/[0-9]/.test(char)) {
            e.preventDefault();
      	  }
    	});
	}

	// ✅ PARENT CONTACT NUMBERS - Same validation
	const fatherContactInput = document.getElementById('fatherContact');
	const motherContactInput = document.getElementById('motherContact');
	const guardianContactInput = document.getElementById('guardianContact');

	[fatherContactInput, motherContactInput, guardianContactInput].forEach(input => {
   	 if (input) {
       	 input.addEventListener('input', function(e) {
          	  let value = this.value.replace(/\D/g, '');
           	 if (value.length > 11) {
           	     value = value.slice(0, 11);
           	 }
           	 this.value = value;
       		 });
        
       	 input.addEventListener('keypress', function(e) {
            const char = String.fromCharCode(e.which);
            if (!/[0-9]/.test(char)) {
                e.preventDefault();
            }
       	 });
        
       	 // Add pattern and maxlength attributes
       	 input.setAttribute('pattern', '[0-9]{11}');
       	 input.setAttribute('maxlength', '11');
    }
	});

	// ✅ EMAIL VALIDATION - Real-time feedback
	const emailInput = document.getElementById('email');

	if (emailInput) {
   	 emailInput.addEventListener('blur', function() {
        const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
        
        if (this.value && !emailRegex.test(this.value)) {
            this.setCustomValidity('Please enter a valid email address');
            this.reportValidity();
        } else {
            this.setCustomValidity('');
        }
    });
    
    emailInput.addEventListener('input', function() {
        this.setCustomValidity('');
    });
}

// ✅ NAME FIELDS - Only letters and spaces
const nameFields = [
    document.getElementById('lastName'),
    document.getElementById('firstName'),
    document.getElementById('middleName')
];

nameFields.forEach(input => {
    if (input) {
        input.addEventListener('keypress', function(e) {
            const char = String.fromCharCode(e.which);
            // Allow letters, spaces, hyphens, and apostrophes
            if (!/[a-zA-Z\s\-']/.test(char)) {
                e.preventDefault();
            }
        });
    }
});

// ============================================
// CUSTOM MODERN CALENDAR WITH CLICKABLE MONTH/YEAR
// ============================================

let currentCalendarDate = new Date();
let selectedDate = null;
let activeInput = null;

const calendarOverlay = document.getElementById('calendarOverlay');
const calendarDays = document.getElementById('calendarDays');
const calendarMonthClickable = document.getElementById('calendarMonthClickable');
const calendarYearClickable = document.getElementById('calendarYearClickable');
const calendarDropdownOverlay = document.getElementById('calendarDropdownOverlay');
const calendarDropdownGrid = document.getElementById('calendarDropdownGrid');
const dropdownTitle = document.getElementById('dropdownTitle');
const calendarPrevMonth = document.getElementById('calendarPrevMonth');
const calendarNextMonth = document.getElementById('calendarNextMonth');
const calendarToday = document.getElementById('calendarToday');
const calendarClear = document.getElementById('calendarClear');
const calendarClose = document.getElementById('calendarClose');

const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// ✅ Click Month to show month selector
if (calendarMonthClickable) {
    calendarMonthClickable.addEventListener('click', function() {
        showMonthSelector();
    });
}

// ✅ Click Year to show year selector
if (calendarYearClickable) {
    calendarYearClickable.addEventListener('click', function() {
        showYearSelector();
    });
}

// ✅ Show Month Selector
function showMonthSelector() {
    dropdownTitle.textContent = 'Select Month';
    calendarDropdownGrid.innerHTML = '';
    calendarDropdownGrid.className = 'calendar-dropdown-grid'; // Remove year-grid class
    
    monthNames.forEach((month, index) => {
        const option = document.createElement('div');
        option.className = 'calendar-dropdown-option';
        option.textContent = month;
        
        if (index === currentCalendarDate.getMonth()) {
            option.classList.add('selected');
        }
        
        option.addEventListener('click', function() {
            currentCalendarDate.setMonth(index);
            closeDropdown();
            renderCalendar();
        });
        
        calendarDropdownGrid.appendChild(option);
    });
    
    calendarDropdownOverlay.classList.add('active');
}

// ✅ Show Year Selector
function showYearSelector() {
    dropdownTitle.textContent = 'Select Year';
    calendarDropdownGrid.innerHTML = '';
    calendarDropdownGrid.className = 'calendar-dropdown-grid year-grid'; // Add year-grid class
    
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 100;
    
    // Show years in descending order (most recent first)
    for (let year = currentYear; year >= startYear; year--) {
        const option = document.createElement('div');
        option.className = 'calendar-dropdown-option';
        option.textContent = year;
        
        if (year === currentCalendarDate.getFullYear()) {
            option.classList.add('selected');
        }
        
        option.addEventListener('click', function() {
            currentCalendarDate.setFullYear(year);
            closeDropdown();
            renderCalendar();
        });
        
        calendarDropdownGrid.appendChild(option);
    }
    
    calendarDropdownOverlay.classList.add('active');
    
    // Scroll to selected year
    setTimeout(() => {
        const selectedOption = calendarDropdownGrid.querySelector('.selected');
        if (selectedOption) {
            selectedOption.scrollIntoView({ block: 'center' });
        }
    }, 100);
}

// ✅ Close Dropdown
function closeDropdown() {
    calendarDropdownOverlay.classList.remove('active');
}

// Close dropdown when clicking overlay
if (calendarDropdownOverlay) {
    calendarDropdownOverlay.addEventListener('click', function(e) {
        if (e.target === calendarDropdownOverlay) {
            closeDropdown();
        }
    });
}

// Open calendar when clicking date input
if (birthDateInput) {
    birthDateInput.addEventListener('click', function(e) {
        e.preventDefault();
        activeInput = this;
        
        // Set current date to input value if exists
        if (this.value) {
            currentCalendarDate = new Date(this.value + 'T00:00:00');
            selectedDate = new Date(this.value + 'T00:00:00');
        } else {
            currentCalendarDate = new Date();
            selectedDate = null;
        }
        
        renderCalendar();
        calendarOverlay.classList.add('active');
    });
}

// Render calendar
function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // ✅ Update month and year text
    calendarMonthClickable.textContent = monthNames[month];
    calendarYearClickable.textContent = year;
    
    // Get first day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);
    
    const firstDayIndex = firstDay.getDay();
    const lastDayDate = lastDay.getDate();
    const prevLastDayDate = prevLastDay.getDate();
    
    // Clear calendar
    calendarDays.innerHTML = '';
    
    // Previous month days
    for (let i = firstDayIndex; i > 0; i--) {
        const day = createDayElement(prevLastDayDate - i + 1, 'other-month', year, month - 1);
        calendarDays.appendChild(day);
    }
    
    // Current month days
    const today = new Date();
    const maxDate = new Date(); // Today
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 100);
    
    for (let i = 1; i <= lastDayDate; i++) {
        const currentDate = new Date(year, month, i);
        let classes = '';
        
        // Check if today
        if (
            i === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear()
        ) {
            classes += 'today ';
        }
        
        // Check if selected
        if (selectedDate &&
            i === selectedDate.getDate() &&
            month === selectedDate.getMonth() &&
            year === selectedDate.getFullYear()
        ) {
            classes += 'selected ';
        }
        
        // Check if disabled (future dates or too old)
        if (currentDate > maxDate || currentDate < minDate) {
            classes += 'disabled ';
        }
        
        const day = createDayElement(i, classes.trim(), year, month);
        calendarDays.appendChild(day);
    }
    
    // Next month days
    const remainingDays = 42 - (firstDayIndex + lastDayDate); // 6 weeks = 42 days
    for (let i = 1; i <= remainingDays; i++) {
        const day = createDayElement(i, 'other-month', year, month + 1);
        calendarDays.appendChild(day);
    }
}

// Create day element
function createDayElement(day, classes, year, month) {
    const dayElement = document.createElement('div');
    dayElement.classList.add('calendar-day');
    
    if (classes) {
        const classList = classes.split(' ');
        classList.forEach(cls => dayElement.classList.add(cls));
    }
    
    dayElement.textContent = day;
    
    // Add click event if not disabled
    if (!classes.includes('disabled')) {
        dayElement.addEventListener('click', function() {
            selectDate(year, month, day);
        });
    }
    
    return dayElement;
}

// Select date
function selectDate(year, month, day) {
    selectedDate = new Date(year, month, day);
    
    // Format date as YYYY-MM-DD
    const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    if (activeInput) {
        activeInput.value = formattedDate;
        
        // Trigger change event to calculate age
        const event = new Event('change', { bubbles: true });
        activeInput.dispatchEvent(event);
    }
    
    // Close calendar
    closeCalendar();
}

// Navigation
if (calendarPrevMonth) {
    calendarPrevMonth.addEventListener('click', function() {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });
}

if (calendarNextMonth) {
    calendarNextMonth.addEventListener('click', function() {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });
}

// Today button
if (calendarToday) {
    calendarToday.addEventListener('click', function() {
        const today = new Date();
        selectDate(today.getFullYear(), today.getMonth(), today.getDate());
    });
}

// Clear button
if (calendarClear) {
    calendarClear.addEventListener('click', function() {
        if (activeInput) {
            activeInput.value = '';
            if (ageInput) {
                ageInput.value = '';
            }
        }
        selectedDate = null;
        closeCalendar();
    });
}

// Close button
if (calendarClose) {
    calendarClose.addEventListener('click', closeCalendar);
}

// Close when clicking overlay
if (calendarOverlay) {
    calendarOverlay.addEventListener('click', function(e) {
        if (e.target === calendarOverlay) {
            closeCalendar();
        }
    });
}

// Close calendar function
function closeCalendar() {
    calendarOverlay.classList.remove('active');
    activeInput = null;
}

// Close with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        if (calendarDropdownOverlay.classList.contains('active')) {
            closeDropdown();
        } else if (calendarOverlay.classList.contains('active')) {
            closeCalendar();
        }
    }
});

    
    // ============================================
    // FLOATING LABEL FIX FOR SELECT
    // ============================================
    
    // Trigger label float when select changes
    document.querySelectorAll('.floating-input select').forEach(select => {
        select.addEventListener('change', function() {
            if (this.value) {
                this.setAttribute('data-has-value', 'true');
            } else {
                this.removeAttribute('data-has-value');
            }
        });
    });
    
    // ============================================
    // MULTI-STEP NAVIGATION
    // ============================================
    
    window.nextStep = function() {
        if (validateCurrentStep()) {
            if (currentStep < totalSteps) {
                currentStep++;
                updateStep();
            }
        }
    };
    
    window.prevStep = function() {
        if (currentStep > 1) {
            currentStep--;
            updateStep();
        }
    };
    
    function updateStep() {
        // Hide all steps
        document.querySelectorAll('.form-step').forEach(step => {
            step.classList.remove('active');
        });
        
        // Show current step
        const activeStep = document.querySelector(`.form-step[data-step="${currentStep}"]`);
        if (activeStep) {
            activeStep.classList.add('active');
        }
        
        // Update progress bar
        updateProgressBar();
        
        // Update progress steps
        updateProgressSteps();
        
        // If step 5 (review), populate review
        if (currentStep === 5) {
            populateReview();
        }
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    function updateProgressBar() {
        const progressFill = document.getElementById('progressFill');
        const percentage = (currentStep / totalSteps) * 100;
        progressFill.style.width = percentage + '%';
    }
    
    function updateProgressSteps() {
        document.querySelectorAll('.progress-step').forEach((step, index) => {
            const stepNumber = index + 1;
            
            step.classList.remove('active', 'completed');
            
            if (stepNumber === currentStep) {
                step.classList.add('active');
            } else if (stepNumber < currentStep) {
                step.classList.add('completed');
            }
        });
    }
    
 // ============================================
// VALIDATION (UPDATED - Only validates current visible step)
// ============================================

function validateCurrentStep() {
    const currentStepElement = document.querySelector(`.form-step[data-step="${currentStep}"]`);
    const requiredInputs = currentStepElement.querySelectorAll('input[required]:not([type="checkbox"]), select[required]');
    const requiredCheckboxes = currentStepElement.querySelectorAll('input[type="checkbox"][required]');
    
    let isValid = true;
    let errorMessage = '';
    
    // ✅ Validate text inputs and selects
    requiredInputs.forEach(input => {
        // Check if field is empty
        if (!input.value || !input.value.trim()) {
            isValid = false;
            input.style.borderColor = 'red';
            
            setTimeout(() => {
                input.style.borderColor = '';
            }, 2000);
        }
        // ✅ Validate contact number length
        else if (input.id && (input.id.includes('contact') || input.id.includes('Contact'))) {
            if (input.value.length !== 11) {
                isValid = false;
                errorMessage = 'Contact number must be exactly 11 digits';
                input.style.borderColor = 'red';
                
                setTimeout(() => {
                    input.style.borderColor = '';
                }, 2000);
            }
        }
        // ✅ Validate email format
        else if (input.type === 'email') {
            const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(input.value)) {
                isValid = false;
                errorMessage = 'Please enter a valid email address';
                input.style.borderColor = 'red';
                
                setTimeout(() => {
                    input.style.borderColor = '';
                }, 2000);
            }
        }
    });
    
    // ✅ Validate checkboxes (only in Step 5 - Review)
    if (currentStep === 5) {
        requiredCheckboxes.forEach(checkbox => {
            if (!checkbox.checked) {
                isValid = false;
                errorMessage = 'Please accept the terms and conditions';
                checkbox.style.outline = '2px solid red';
                
                setTimeout(() => {
                    checkbox.style.outline = '';
                }, 2000);
            }
        });
    }
    
    if (!isValid) {
        alert(errorMessage || 'Please fill in all required fields correctly before proceeding.');
    }
    
    return isValid;
}
    
    // ============================================
    // POPULATE REVIEW SECTION
    // ============================================
    

// ── Safe review renderer (XSS-safe innerHTML replacement) ──────
function safeField(label, value) {
    const s = CSHC_Security.sanitize(String(value || ''));
    return `<p><strong>${CSHC_Security.sanitize(label)}:</strong> ${s}</p>`;
}
    function populateReview() {
        // Campus & Program
        const campusName = campusPrograms[campusSelect.value]?.name || campusSelect.value;
        const gradeLevelText = gradeLevelSelect.options[gradeLevelSelect.selectedIndex]?.text || '';
        const studentTypeText = document.getElementById('studentType').options[document.getElementById('studentType').selectedIndex]?.text || '';
        
        const semesterEl  = document.getElementById('semester')
        const semesterVal = semesterEl && semesterEl.value
        const semesterMap = { '1st':'1st Semester', '2nd':'2nd Semester', 'summer':'Summer Semester' }
        const semesterTxt = semesterMap[semesterVal] || ''
        document.getElementById('reviewCampus').innerHTML = `
            <p><strong>Campus:</strong> ${campusName}</p>
            <p><strong>Grade Level / Program:</strong> ${gradeLevelText}</p>
            ${semesterTxt ? `<p><strong>Semester:</strong> ${semesterTxt}</p>` : ''}
            <p><strong>Student Type:</strong> ${studentTypeText}</p>
            <p><strong>School Year:</strong> ${document.getElementById('schoolYear').value}</p>
        `;
        
        // Student Information
        
		document.getElementById('reviewStudent').innerHTML = `
    		<p><strong>Name:</strong> ${document.getElementById('firstName').value} ${document.getElementById('middleName').value} ${document.getElementById('lastName').value}</p>
    		<p><strong>Birth Date:</strong> ${document.getElementById('birthDate').value}</p>
   			<p><strong>Place of Birth:</strong> ${document.getElementById('birthPlace').value}</p>
   			<p><strong>Age:</strong> ${document.getElementById('age').value}</p>
    		<p><strong>Gender:</strong> ${document.getElementById('gender').value}</p>
    		<p><strong>Civil Status:</strong> ${document.getElementById('civilStatus').value}</p>
    		<p><strong>Religion:</strong> ${document.getElementById('religion').value}</p>
    		<p><strong>Nationality:</strong> ${document.getElementById('nationality').value}</p>
    		<p><strong>Address:</strong> ${document.getElementById('address').value}</p>
    		<p><strong>Email:</strong> ${document.getElementById('email').value}</p>
    		<p><strong>Contact:</strong> ${document.getElementById('contactNumber').value}</p>
`	;
        
        // Parent/Guardian
        document.getElementById('reviewParent').innerHTML = `
            <p><strong>Father:</strong> ${document.getElementById('fatherName').value}</p>
            <p><strong>Occupation:</strong> ${document.getElementById('fatherOccupation').value || 'N/A'}</p>
            <p><strong>Contact:</strong> ${document.getElementById('fatherContact').value}</p>
            <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--light-cream);">
            <p><strong>Mother:</strong> ${document.getElementById('motherName').value}</p>
            <p><strong>Occupation:</strong> ${document.getElementById('motherOccupation').value || 'N/A'}</p>
            <p><strong>Contact:</strong> ${document.getElementById('motherContact').value}</p>
            ${document.getElementById('guardianName').value ? `
            <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--light-cream);">
            <p><strong>Guardian:</strong> ${document.getElementById('guardianName').value}</p>
            <p><strong>Relation:</strong> ${document.getElementById('guardianRelation').value || 'N/A'}</p>
            <p><strong>Contact:</strong> ${document.getElementById('guardianContact').value || 'N/A'}</p>
            ` : ''}
        `;
        
        // Previous School / Preliminary Education
const isCollege = document.getElementById('detailedEducationForm').style.display !== 'none';

if (isCollege) {
    // Show detailed education history
    document.getElementById('reviewSchool').innerHTML = `
        <h4 style="color: var(--secondary-coral); margin-bottom: 0.5rem;">Elementary:</h4>
        <p><strong>School:</strong> ${document.getElementById('elementarySchool').value || 'N/A'}</p>
        <p><strong>Address:</strong> ${document.getElementById('elementaryAddress').value || 'N/A'}</p>
        <p><strong>Year:</strong> ${document.getElementById('elementaryYear').value || 'N/A'}</p>
        
        <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--light-cream);">
        
        <h4 style="color: var(--secondary-coral); margin-bottom: 0.5rem;">Junior High School:</h4>
        <p><strong>School:</strong> ${document.getElementById('juniorHighSchool').value || 'N/A'}</p>
        <p><strong>Address:</strong> ${document.getElementById('juniorHighAddress').value || 'N/A'}</p>
        <p><strong>Year:</strong> ${document.getElementById('juniorHighYear').value || 'N/A'}</p>
        
        <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--light-cream);">
        
        <h4 style="color: var(--secondary-coral); margin-bottom: 0.5rem;">Senior High School:</h4>
        <p><strong>School:</strong> ${document.getElementById('seniorHighSchool').value || 'N/A'}</p>
        <p><strong>Address:</strong> ${document.getElementById('seniorHighAddress').value || 'N/A'}</p>
        <p><strong>Year:</strong> ${document.getElementById('seniorHighYear').value || 'N/A'}</p>
        
        ${document.getElementById('lastCollegeSchool').value ? `
            <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--light-cream);">
            <h4 style="color: var(--secondary-coral); margin-bottom: 0.5rem;">Last College:</h4>
            <p><strong>School:</strong> ${document.getElementById('lastCollegeSchool').value}</p>
            <p><strong>Address:</strong> ${document.getElementById('lastCollegeAddress').value || 'N/A'}</p>
            <p><strong>Year:</strong> ${document.getElementById('lastCollegeYear').value || 'N/A'}</p>
        ` : ''}
    `;
} else {
    // Show simple previous school
    document.getElementById('reviewSchool').innerHTML = `
        <p><strong>Last School:</strong> ${document.getElementById('lastSchool').value}</p>
        <p><strong>Address:</strong> ${document.getElementById('schoolAddress').value || 'N/A'}</p>
        <p><strong>Last Grade:</strong> ${document.getElementById('lastGrade').value || 'N/A'}</p>
        <p><strong>School Year:</strong> ${document.getElementById('lastSchoolYear').value || 'N/A'}</p>
    `;
}
    }
    
    // ============================================
    // FORM SUBMISSION
    // ============================================
    
    enrollmentForm.addEventListener('submit', function(e) {
        e.preventDefault();

        // ── Security Check 1: Duplicate submission prevention ──
        if (CSHC_Security.isAlreadySubmitted()) {
            alert('This form has already been submitted. Please refresh the page to submit a new enrollment.');
            return;
        }

        // ── Security Check 2: Honeypot bot detection ───────────
        if (!CSHC_Security.checkHoneypot()) {
            console.warn('[CSHC Security] Honeypot triggered.');
            return;
        }

        // ── Security Check 3: Rate limiting ────────────────────
        const rateCheck = CSHC_Security.checkRateLimit();
        if (!rateCheck.allowed) {
            alert(rateCheck.message);
            return;
        }

        // ── Security Check 4: Terms acceptance ─────────────────
        if (!document.getElementById('termsAccept').checked || !document.getElementById('dataPrivacy').checked) {
            alert('Please accept the terms and conditions to proceed.');
            return;
        }

        // ── Security Check 5: Age validation ───────────────────
        const ageCheck = CSHC_Security.validateAge(document.getElementById('birthDate').value);
        if (!ageCheck.valid) {
            alert(ageCheck.message);
            return;
        }

        // ── Collect and sanitize form data ──────────────────────
        const formData = new FormData(enrollmentForm);
        let data = Object.fromEntries(formData);

        try {
            data = CSHC_Security.sanitizeFormData(data);
        } catch (err) {
            alert('Invalid content detected in the form. Please review your entries and try again.');
            console.warn('[CSHC Security] Blocked:', err.message);
            return;
        }

        // Add campus display name
        if (data.campus && campusPrograms[data.campus]) {
            data.campusName = campusPrograms[data.campus].name;
        }

        // ── Submit to admin portal via bridge ───────────────────
        let refNum = 'CSHC-' + Date.now().toString().slice(-8);
        try {
            const result = CSHC_Bridge.submitToAdminPortal(data);
            if (result.success) {
                refNum = result.referenceNumber;
                console.log('[CSHC] Enrollment saved:', refNum);
            }
        } catch (err) {
            console.warn('[CSHC] Bridge not available:', err);
        }

        // ── Record submission (rate limit counter) ──────────────
        CSHC_Security.markSubmitted();
        CSHC_Security.recordSubmission();

        // Show success screen
        referenceNumber.textContent = refNum;
        enrollmentForm.style.display = 'none';
        document.getElementById('progressContainer').style.display = 'none';
        successMessage.classList.add('show');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    // ============================================
    // INITIALIZE
    // ============================================
    
    // Set initial progress
    updateProgressBar();
    updateProgressSteps();
    
});