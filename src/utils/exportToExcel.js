import * as XLSX from 'xlsx'

/**
 * Export data to Excel file
 */
export const exportToExcel = (data, filename, sheetName = 'Sheet1') => {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

/**
 * Export multiple sheets to one Excel file
 */
export const exportMultipleSheets = (sheets, filename) => {
  const workbook = XLSX.utils.book_new()
  
  sheets.forEach(({ data, sheetName }) => {
    const worksheet = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  })
  
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}