import { forwardRef } from 'react'

const PrintableStudent = forwardRef(({ student }, ref) => {
  if (!student) return null

  return (
    <>
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box !important; }
          html, body { margin: 0 !important; padding: 0 !important; width: 8.5in !important; height: 13in !important; }
          @page { size: 8.5in 13in; margin: 0; }
          .no-print { display: none !important; }
          .print-root {
            width: 8.5in !important;
            height: 13in !important;
            padding: 0.45in 0.55in !important;
            font-size: 10pt !important;
            line-height: 1.4 !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
          }
          .print-spacer { flex: 1 !important; }
        }

        .print-root {
          font-family: Arial, sans-serif;
          font-size: 10pt;
          line-height: 1.4;
          color: #000;
          background: #fff;
          width: 8.5in;
          height: 13in;
          margin: 0 auto;
          padding: 0.45in 0.55in;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* ── Section header bar ── */
        .pr-sec {
          background-color: #750014;
          color: #fff;
          font-weight: bold;
          font-size: 9pt;
          padding: 4px 10px;
          margin-top: 11px;
          margin-bottom: 7px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        /* ── Field label ── */
        .pr-lbl {
          font-size: 7pt;
          color: #666;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 2px;
        }

        /* ── Field value ── */
        .pr-val {
          font-size: 10pt;
          font-weight: 500;
          color: #000;
          border-bottom: 0.5px solid #ccc;
          padding-bottom: 3px;
          min-height: 16px;
        }

        /* ── Grids ── */
        .pr-g2 { display: grid; grid-template-columns: 1fr 1fr;         gap: 8px 24px; margin-bottom: 6px; }
        .pr-g3 { display: grid; grid-template-columns: 1fr 1fr 1fr;     gap: 8px 20px; margin-bottom: 6px; }
        .pr-g4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px 18px; margin-bottom: 6px; }
        .pr-g5 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; gap: 8px 16px; margin-bottom: 6px; }
        .pr-s2 { grid-column: span 2; }
        .pr-s3 { grid-column: span 3; }
        .pr-s4 { grid-column: span 4; }

        /* ── Sub-label (Father / Mother) ── */
        .pr-sub {
          font-size: 8.5pt;
          font-weight: 700;
          color: #750014;
          margin-bottom: 5px;
          margin-top: 5px;
        }

        /* ── Signature line ── */
        .pr-sig-line { border-bottom: 1px solid #000; height: 28px; margin-bottom: 4px; }
        .pr-sig-lbl  { font-size: 7.5pt; color: #555; text-align: center; }
      `}</style>

      <div ref={ref} className="print-root">

        {/* ══ HEADER ══ */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'3px solid #750014', paddingBottom:'8px', marginBottom:'4px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ width:'52px', height:'52px', borderRadius:'50%', background:'#750014', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <span style={{ color:'#fff', fontWeight:'bold', fontSize:'16pt' }}>C</span>
            </div>
            <div>
              <div style={{ fontSize:'16pt', fontWeight:'bold', color:'#750014', lineHeight:1 }}>Cebu Sacred Heart College</div>
              <div style={{ fontSize:'8.5pt', color:'#555', marginTop:'3px' }}>CSHC Admin Portal — Official Student Profile</div>
            </div>
          </div>
          <div style={{ textAlign:'right', fontSize:'8pt', color:'#555' }}>
            <div style={{ fontWeight:'bold', fontSize:'11pt', color:'#750014' }}>{student.studentId}</div>
            <div style={{ marginTop:'3px' }}>
              <span style={{ background: student.status === 'active' ? '#dcfce7' : '#f3f4f6', color: student.status === 'active' ? '#166534' : '#374151', padding:'2px 9px', borderRadius:'10px', fontWeight:'bold', fontSize:'8pt' }}>
                {student.status.toUpperCase()}
              </span>
            </div>
            <div style={{ marginTop:'4px', color:'#888' }}>Generated: {new Date().toLocaleDateString('en-US',{ year:'numeric', month:'long', day:'numeric' })}</div>
          </div>
        </div>

        {/* ══ PERSONAL INFORMATION ══ */}
        <div className="pr-sec">Personal Information</div>
        <div className="pr-g4">
          <div className="pr-s2"><div className="pr-lbl">Full Name</div><div className="pr-val">{student.personal.firstName} {student.personal.middleName} {student.personal.lastName}</div></div>
          <div><div className="pr-lbl">Birth Date</div><div className="pr-val">{new Date(student.personal.birthDate).toLocaleDateString('en-US',{ year:'numeric', month:'short', day:'numeric' })}</div></div>
          <div><div className="pr-lbl">Age</div><div className="pr-val">{student.personal.age} years old</div></div>
        </div>
        <div className="pr-g4">
          <div><div className="pr-lbl">Gender</div><div className="pr-val">{student.personal.gender}</div></div>
          <div><div className="pr-lbl">Civil Status</div><div className="pr-val">{student.personal.civilStatus || 'Single'}</div></div>
          <div><div className="pr-lbl">Religion</div><div className="pr-val">{student.personal.religion}</div></div>
          <div><div className="pr-lbl">Nationality</div><div className="pr-val">{student.personal.nationality}</div></div>
        </div>
        <div className="pr-g4">
          <div><div className="pr-lbl">Place of Birth</div><div className="pr-val">{student.personal.placeOfBirth}</div></div>
          <div><div className="pr-lbl">Contact Number</div><div className="pr-val">{student.personal.contactNumber}</div></div>
          <div className="pr-s2"><div className="pr-lbl">Email Address</div><div className="pr-val">{student.personal.email}</div></div>
        </div>
        <div className="pr-g2" style={{ marginBottom:0 }}>
          <div className="pr-s2"><div className="pr-lbl">Home Address</div><div className="pr-val">{student.personal.address}</div></div>
        </div>

        {/* ══ ACADEMIC INFORMATION ══ */}
        <div className="pr-sec">Academic Information</div>
        <div className="pr-g4">
          <div><div className="pr-lbl">Campus</div><div className="pr-val">{student.academic.campus}</div></div>
          <div><div className="pr-lbl">Grade / Year Level</div><div className="pr-val">{student.academic.gradeLevel}</div></div>
          <div><div className="pr-lbl">Section</div><div className="pr-val">{student.academic.section || '—'}</div></div>
          <div><div className="pr-lbl">Student Type</div><div className="pr-val">{student.academic.studentType}</div></div>
        </div>
        <div className="pr-g4">
          <div><div className="pr-lbl">School Year</div><div className="pr-val">{student.academic.schoolYear}</div></div>
          <div><div className="pr-lbl">Enrollment Date</div><div className="pr-val">{new Date(student.enrollmentDate).toLocaleDateString('en-US',{ year:'numeric', month:'short', day:'numeric' })}</div></div>
          <div><div className="pr-lbl">Year Level</div><div className="pr-val">{student.academic.yearLevel || '—'}</div></div>
          <div><div className="pr-lbl">Track / Strand</div><div className="pr-val">{student.academic.track || '—'}</div></div>
        </div>

        {/* ══ PARENT / GUARDIAN INFORMATION ══ */}
        <div className="pr-sec">Parent / Guardian Information</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 24px' }}>
          <div>
            <div className="pr-sub">Father</div>
            <div className="pr-g3" style={{ gridTemplateColumns:'1fr 1fr 1fr' }}>
              <div><div className="pr-lbl">Name</div><div className="pr-val">{student.parents.father.name}</div></div>
              <div><div className="pr-lbl">Occupation</div><div className="pr-val">{student.parents.father.occupation}</div></div>
              <div><div className="pr-lbl">Contact</div><div className="pr-val">{student.parents.father.contactNumber}</div></div>
            </div>
          </div>
          <div>
            <div className="pr-sub">Mother</div>
            <div className="pr-g3" style={{ gridTemplateColumns:'1fr 1fr 1fr' }}>
              <div><div className="pr-lbl">Name</div><div className="pr-val">{student.parents.mother.name}</div></div>
              <div><div className="pr-lbl">Occupation</div><div className="pr-val">{student.parents.mother.occupation}</div></div>
              <div><div className="pr-lbl">Contact</div><div className="pr-val">{student.parents.mother.contactNumber}</div></div>
            </div>
          </div>
        </div>

        {student.parents?.guardian?.name && student.parents.guardian.name !== 'N/A' && (
          <div style={{ marginTop:'6px' }}>
            <div className="pr-sub">Guardian</div>
            <div className="pr-g4">
              <div className="pr-s2"><div className="pr-lbl">Name</div><div className="pr-val">{student.parents.guardian.name}</div></div>
              <div><div className="pr-lbl">Relationship</div><div className="pr-val">{student.parents.guardian.relationship || '—'}</div></div>
              <div><div className="pr-lbl">Contact</div><div className="pr-val">{student.parents.guardian.contactNumber}</div></div>
            </div>
          </div>
        )}

        {/* ══ PREVIOUS SCHOOL INFORMATION ══ */}
        <div className="pr-sec">Previous School Information</div>
        <div className="pr-g4">
          <div className="pr-s2"><div className="pr-lbl">School Name</div><div className="pr-val">{student.previousSchool.name}</div></div>
          <div className="pr-s2"><div className="pr-lbl">Address</div><div className="pr-val">{student.previousSchool.address}</div></div>
        </div>
        <div className="pr-g4">
          <div><div className="pr-lbl">Last Grade / Year</div><div className="pr-val">{student.previousSchool.lastGrade}</div></div>
          <div><div className="pr-lbl">School Year</div><div className="pr-val">{student.previousSchool.schoolYear}</div></div>
          <div><div className="pr-lbl">General Average</div><div className="pr-val">{student.previousSchool.generalAverage || '—'}</div></div>
          <div><div className="pr-lbl">Honors Received</div><div className="pr-val">{student.previousSchool.honors || '—'}</div></div>
        </div>

        {/* ══ SPACER — pushes signature to bottom ══ */}
        <div className="print-spacer" />

        {/* ══ SIGNATURE BLOCK ══ */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0 28px', paddingTop:'12px', borderTop:'0.5px solid #ccc' }}>
          {['Registrar\'s Signature', 'Date Issued', 'Official Seal / Dry Seal'].map(lbl => (
            <div key={lbl} style={{ textAlign:'center' }}>
              <div className="pr-sig-line" />
              <div className="pr-sig-lbl">{lbl}</div>
            </div>
          ))}
        </div>

        {/* ══ FOOTER ══ */}
        <div style={{ textAlign:'center', fontSize:'7pt', color:'#aaa', marginTop:'8px', borderTop:'0.5px solid #eee', paddingTop:'5px' }}>
          Cebu Sacred Heart College — CSHC Admin Portal &nbsp;|&nbsp; This is a system-generated document. &nbsp;|&nbsp; {student.studentId}
        </div>

      </div>
    </>
  )
})

PrintableStudent.displayName = 'PrintableStudent'
export default PrintableStudent