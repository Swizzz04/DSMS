import { describe, it, expect } from 'vitest'
import { computeStudentBill, computeCollegeFee } from '../config/appConfig'

describe('fee totals: the enrollment fee is never added to the grand total', () => {
  it('Basic Ed bill keeps the enrollment fee out of grandTotal', () => {
    const bill = computeStudentBill(
      { tuition: 20000, enrollment: 1500, misc: 3000, lab: 500, books: 1000, other: 250 }, [])
    expect(bill.enrollment).toBe(1500)
    expect(bill.grandTotal).toBe(20000 + 3000 + 500 + 1000 + 250)
  })

  it('a missing lab/books/other fee counts as zero', () => {
    const bill = computeStudentBill({ tuition: 10000, enrollment: 1000, misc: 2000 }, [])
    expect(bill.grandTotal).toBe(12000)
  })

  it('College semester total is tuition + lab + misc only', () => {
    const fee = computeCollegeFee({
      tuitionRatePerUnit: 800, labRatePerUnit: 1200,
      typicalUnits: 21, typicalLabUnits: 2, enrollment: 1500, misc: 4000,
    })
    expect(fee.tuition).toBe(800 * 21)
    expect(fee.lab).toBe(1200 * 2)
    expect(fee.enrollment).toBe(1500)
    expect(fee.grandTotal).toBe(800 * 21 + 1200 * 2 + 4000)
    expect(fee.semTotal).toBe(fee.grandTotal)
  })

  it('College fee follows the units actually taken and flags overload / underload', () => {
    const entry = { tuitionRatePerUnit: 100, typicalUnits: 20, typicalLabUnits: 0, enrollment: 500, misc: 0 }
    expect(computeCollegeFee(entry, 24).isOverload).toBe(true)
    expect(computeCollegeFee(entry, 15).isUnderload).toBe(true)
    expect(computeCollegeFee(entry, 24).grandTotal).toBe(2400)
  })

  it('no fee entry gives an empty bill, not an error', () => {
    expect(computeCollegeFee(null).total).toBe(0)
  })
})
