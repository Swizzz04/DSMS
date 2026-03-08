import { forwardRef } from 'react'

const PrintableStudent = forwardRef(({ student }, ref) => {
  if (!student) return null

  return (
    <>
      {/* Print Styles — must be outside the ref div so they apply globally */}
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { margin: 0; padding: 0; }
          @page {
            size: 8.5in 13in;
            margin: 0.45in 0.5in;
          }
          .no-print { display: none !important; }
          .print-root {
            width: 100%;
            font-size: 8.5pt;
            line-height: 1.3;
            color: #000;
            background: #fff;
          }
        }
        /* Screen preview styles */
        .print-root {
          font-family: Arial, sans-serif;
          font-size: 8.5pt;
          line-height: 1.3;
          color: #000;
          background: #fff;
          width: 7.5in;
          margin: 0 auto;
          padding: 0.4in 0.5in;
        }
        .print-root .section-header {
          background-color: #750014;
          color: #fff;
          font-weight: bold;
          font-size: 8pt;
          padding: 3px 8px;
          margin-bottom: 5px;
          margin-top: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .print-root .field-label {
          font-size: 6.5pt;
          color: #666;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 1px;
        }
        .print-root .field-value {
          font-size: 8.5pt;
          font-weight: 500;
          color: #000;
          border-bottom: 0.5px solid #ddd;
          padding-bottom: 2px;
          min-height: 13px;
        }
        .print-root .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px 20px;
          margin-bottom: 4px;
        }
        .print-root .grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 6px 16px;
          margin-bottom: 4px;
        }
        .print-root .grid-4 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          gap: 6px 16px;
          margin-bottom: 4px;
        }
        .print-root .span-2 { grid-column: span 2; }
        .print-root .span-3 { grid-column: span 3; }
        .print-root .divider {
          border: none;
          border-top: 0.5px solid #ccc;
          margin: 4px 0;
        }
        .print-root .sub-label {
          font-size: 7pt;
          font-weight: 700;
          color: #750014;
          margin-bottom: 4px;
          margin-top: 4px;
        }
      `}</style>

      <div ref={ref} className="print-root">

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2.5px solid #750014', paddingBottom: '6px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#750014', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '13pt' }}>C</span>
            </div>
            <div>
              <div style={{ fontSize: '14pt', fontWeight: 'bold', color: '#750014', lineHeight: 1 }}>Cebu Sacred Heart College</div>
              <div style={{ fontSize: '7.5pt', color: '#555', marginTop: '2px' }}>CSHC Admin Portal — Official Student Profile</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '7pt', color: '#555' }}>
            <div style={{ fontWeight: 'bold', fontSize: '9pt', color: '#750014' }}>{student.studentId}</div>
            <div style={{ marginTop: '2px' }}>
              <span style={{
                background: student.status === 'active' ? '#dcfce7' : '#f3f4f6',
                color: student.status === 'active' ? '#166534' : '#374151',
                padding: '1px 7px',
                borderRadius: '10px',
                fontWeight: 'bold',
                fontSize: '7pt'
              }}>
                {student.status.toUpperCase()}
              </span>
            </div>
            <div style={{ marginTop: '3px', color: '#888' }}>Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>

        {/* ── PERSONAL INFORMATION ── */}
        <div className="section-header">Personal Information</div>
        <div className="grid-4">
          <div className="span-2">
            <div className="field-label">Full Name</div>
            <div className="field-value">{student.personal.firstName} {student.personal.middleName} {student.personal.lastName}</div>
          </div>
          <div>
            <div className="field-label">Birth Date</div>
            <div className="field-value">{new Date(student.personal.birthDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
          </div>
          <div>
            <div className="field-label">Age</div>
            <div className="field-value">{student.personal.age} years old</div>
          </div>
        </div>
        <div className="grid-4">
          <div>
            <div className="field-label">Gender</div>
            <div className="field-value">{student.personal.gender}</div>
          </div>
          <div>
            <div className="field-label">Civil Status</div>
            <div className="field-value">{student.personal.civilStatus || 'Single'}</div>
          </div>
          <div>
            <div className="field-label">Religion</div>
            <div className="field-value">{student.personal.religion}</div>
          </div>
          <div>
            <div className="field-label">Nationality</div>
            <div className="field-value">{student.personal.nationality}</div>
          </div>
        </div>
        <div className="grid-4">
          <div>
            <div className="field-label">Place of Birth</div>
            <div className="field-value">{student.personal.placeOfBirth}</div>
          </div>
          <div>
            <div className="field-label">Contact Number</div>
            <div className="field-value">{student.personal.contactNumber}</div>
          </div>
          <div className="span-2">
            <div className="field-label">Email Address</div>
            <div className="field-value">{student.personal.email}</div>
          </div>
        </div>
        <div className="grid-2" style={{ marginBottom: 0 }}>
          <div className="span-2">
            <div className="field-label">Home Address</div>
            <div className="field-value">{student.personal.address}</div>
          </div>
        </div>

        {/* ── ACADEMIC INFORMATION ── */}
        <div className="section-header">Academic Information</div>
        <div className="grid-4">
          <div>
            <div className="field-label">Campus</div>
            <div className="field-value">{student.academic.campus}</div>
          </div>
          <div>
            <div className="field-label">Grade / Year Level</div>
            <div className="field-value">{student.academic.gradeLevel}</div>
          </div>
          <div>
            <div className="field-label">Section</div>
            <div className="field-value">{student.academic.section || '—'}</div>
          </div>
          <div>
            <div className="field-label">Student Type</div>
            <div className="field-value">{student.academic.studentType}</div>
          </div>
        </div>
        <div className="grid-4">
          <div>
            <div className="field-label">School Year</div>
            <div className="field-value">{student.academic.schoolYear}</div>
          </div>
          <div>
            <div className="field-label">Enrollment Date</div>
            <div className="field-value">{new Date(student.enrollmentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
          </div>
          <div>
            <div className="field-label">Year Level</div>
            <div className="field-value">{student.academic.yearLevel || '—'}</div>
          </div>
          <div>
            <div className="field-label">Track / Strand</div>
            <div className="field-value">{student.academic.track || '—'}</div>
          </div>
        </div>

        {/* ── PARENT / GUARDIAN INFORMATION ── */}
        <div className="section-header">Parent / Guardian Information</div>

        {/* Father & Mother side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div>
            <div className="sub-label">Father</div>
            <div className="grid-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div>
                <div className="field-label">Name</div>
                <div className="field-value">{student.parents.father.name}</div>
              </div>
              <div>
                <div className="field-label">Occupation</div>
                <div className="field-value">{student.parents.father.occupation}</div>
              </div>
              <div>
                <div className="field-label">Contact</div>
                <div className="field-value">{student.parents.father.contactNumber}</div>
              </div>
            </div>
          </div>
          <div>
            <div className="sub-label">Mother</div>
            <div className="grid-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div>
                <div className="field-label">Name</div>
                <div className="field-value">{student.parents.mother.name}</div>
              </div>
              <div>
                <div className="field-label">Occupation</div>
                <div className="field-value">{student.parents.mother.occupation}</div>
              </div>
              <div>
                <div className="field-label">Contact</div>
                <div className="field-value">{student.parents.mother.contactNumber}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Guardian if applicable */}
        {student.parents.guardian && student.parents.guardian.name && student.parents.guardian.name !== 'N/A' && (
          <div style={{ marginTop: '4px' }}>
            <div className="sub-label">Guardian</div>
            <div className="grid-4">
              <div className="span-2">
                <div className="field-label">Name</div>
                <div className="field-value">{student.parents.guardian.name}</div>
              </div>
              <div>
                <div className="field-label">Relationship</div>
                <div className="field-value">{student.parents.guardian.relationship || '—'}</div>
              </div>
              <div>
                <div className="field-label">Contact</div>
                <div className="field-value">{student.parents.guardian.contactNumber}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── PREVIOUS SCHOOL INFORMATION ── */}
        <div className="section-header">Previous School Information</div>
        <div className="grid-4">
          <div className="span-2">
            <div className="field-label">School Name</div>
            <div className="field-value">{student.previousSchool.name}</div>
          </div>
          <div className="span-2">
            <div className="field-label">Address</div>
            <div className="field-value">{student.previousSchool.address}</div>
          </div>
        </div>
        <div className="grid-4">
          <div>
            <div className="field-label">Last Grade / Year</div>
            <div className="field-value">{student.previousSchool.lastGrade}</div>
          </div>
          <div>
            <div className="field-label">School Year</div>
            <div className="field-value">{student.previousSchool.schoolYear}</div>
          </div>
          <div>
            <div className="field-label">General Average</div>
            <div className="field-value">{student.previousSchool.generalAverage || '—'}</div>
          </div>
          <div>
            <div className="field-label">Honors Received</div>
            <div className="field-value">{student.previousSchool.honors || '—'}</div>
          </div>
        </div>

        {/* ── SIGNATURE BLOCK ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 20px', marginTop: '18px', paddingTop: '10px', borderTop: '0.5px solid #ccc' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderBottom: '1px solid #000', marginBottom: '3px', height: '22px' }}></div>
            <div style={{ fontSize: '7pt', color: '#555' }}>Registrar's Signature</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderBottom: '1px solid #000', marginBottom: '3px', height: '22px' }}></div>
            <div style={{ fontSize: '7pt', color: '#555' }}>Date Issued</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderBottom: '1px solid #000', marginBottom: '3px', height: '22px' }}></div>
            <div style={{ fontSize: '7pt', color: '#555' }}>Official Seal / Dry Seal</div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ textAlign: 'center', fontSize: '6.5pt', color: '#999', marginTop: '6px', borderTop: '0.5px solid #eee', paddingTop: '4px' }}>
          Cebu Sacred Heart College — CSHC Admin Portal &nbsp;|&nbsp; This is a system-generated document. &nbsp;|&nbsp; {student.studentId}
        </div>

      </div>
    </>
  )
})

PrintableStudent.displayName = 'PrintableStudent'

export default PrintableStudent