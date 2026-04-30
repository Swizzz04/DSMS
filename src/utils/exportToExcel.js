// xlsx loaded dynamically — only when user clicks Export (not on page load)
let XLSX = null
async function getXLSX() {
  if (!XLSX) {
    const m = await import('xlsx')
    XLSX = m.default || m
  }
  return XLSX
}

/**
 * Export data to Excel file
 */
export const exportToExcel = async (data, filename, sheetName = 'Sheet1') => {
  const XLSX = await getXLSX()
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

/**
 * Export multiple sheets to one Excel file
 */
export const exportMultipleSheets = async (sheets, filename) => {
  const XLSX = await getXLSX()
  const workbook = XLSX.utils.book_new()

  sheets.forEach(({ data, sheetName }) => {
    const worksheet = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  })

  XLSX.writeFile(workbook, `${filename}.xlsx`)
}