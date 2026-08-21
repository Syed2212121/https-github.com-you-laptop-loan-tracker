<#
.SYNOPSIS
  Pull named columns out of an .xlsx sheet into a CSV the Import screen can read.

.DESCRIPTION
  The Import screen's uploaders are CSV-only (papaparse, accept=".csv"), but the Intune
  and NetSupport DNA consoles both hand you .xlsx. This bridges the two without adding a
  spreadsheet library to the app: an .xlsx is a zip of XML, and everything needed to read
  one is already in .NET.

  Deliberately NOT "open it in Excel and Save As CSV". Excel re-formats on the way out,
  and the classic casualty is a serial like "05-May-04" — a real barcode that Excel
  decided was a date. cleanSerial() in src/lib.js has a guard for exactly that damage.
  This reads RAW cell values and applies no number formats, so a serial arrives as the
  characters the console wrote.

.EXAMPLE
  .\xlsx-to-csv.ps1 -Path ~\Downloads\Device_Intune-SIMS.xlsx `
                    -Out  ~\Downloads\Device_Intune-SIMS.csv `
                    -Columns 'Device name','Serial number','Model'
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]   $Path,
  [Parameter(Mandatory)][string]   $Out,
  # Header names exactly as the source system writes them. The importers in src/lib.js
  # look rows up by these strings, so a casing or spacing change here silently produces
  # a column of nulls rather than an error.
  [Parameter(Mandatory)][string[]] $Columns,
  [string] $Sheet = 'xl/worksheets/sheet1.xml'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$Path = (Resolve-Path $Path).Path
$Out  = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Out)

# "BC" -> 54. Cells are addressed by reference ("A1", "BC7"), and Excel OMITS empty
# cells entirely, so reading <c> elements positionally shifts every value after the
# first gap. Column letters are the only trustworthy index.
function ConvertTo-ColumnIndex([string] $ref) {
  $n = 0
  foreach ($ch in ($ref -replace '[^A-Za-z]', '').ToUpper().ToCharArray()) {
    $n = $n * 26 + ([int][char]$ch - 64)
  }
  return $n - 1
}

# RFC 4180: quote anything holding a comma, a quote or a newline; double inner quotes.
function ConvertTo-CsvField([string] $v) {
  if ($null -eq $v) { return '' }
  if ($v -match '[",\r\n]') { return '"' + $v.Replace('"', '""') + '"' }
  return $v
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
try {
  # Shared strings: most text cells store an index into this table rather than the text.
  $shared = New-Object System.Collections.ArrayList
  $entry = $zip.GetEntry('xl/sharedStrings.xml')
  if ($entry) {
    $reader = New-Object System.IO.StreamReader($entry.Open())
    try { $doc = [xml]$reader.ReadToEnd() } finally { $reader.Close() }
    foreach ($si in $doc.sst.si) {
      # A single <si> can be split across several <t> runs when part of the string was
      # formatted differently; concatenating them is what rebuilds the original value.
      $parts = $si.SelectNodes('.//*[local-name()="t"]') | ForEach-Object { $_.InnerText }
      [void]$shared.Add(-join $parts)
    }
  }

  $entry = $zip.GetEntry($Sheet)
  if (-not $entry) { throw "No '$Sheet' inside $Path." }
  $reader = New-Object System.IO.StreamReader($entry.Open())
  try { $doc = [xml]$reader.ReadToEnd() } finally { $reader.Close() }

  $rows = @($doc.worksheet.sheetData.row)
  if (-not $rows) { throw "Sheet '$Sheet' is empty." }

  function Get-CellValue($c) {
    switch ($c.t) {
      's'         { return $shared[[int]$c.v] }   # shared string
      'inlineStr' { return $c.is.t }              # string stored in the cell itself
      default     { return [string]$c.v }         # raw — no number format applied
    }
  }

  # Row 1 is the header. Map each wanted name to the column index it sits at.
  $header = @{}
  foreach ($c in $rows[0].c) { $header[(Get-CellValue $c)] = (ConvertTo-ColumnIndex $c.r) }

  $missing = $Columns | Where-Object { -not $header.ContainsKey($_) }
  if ($missing) {
    Write-Warning ("Not in this sheet, will be written blank: " + ($missing -join ', '))
  }

  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine((($Columns | ForEach-Object { ConvertTo-CsvField $_ }) -join ','))

  $written = 0
  foreach ($row in ($rows | Select-Object -Skip 1)) {
    $cells = @{}
    foreach ($c in $row.c) { $cells[(ConvertTo-ColumnIndex $c.r)] = (Get-CellValue $c) }
    $fields = foreach ($name in $Columns) {
      $i = $header[$name]
      if ($null -ne $i -and $cells.ContainsKey($i)) { ConvertTo-CsvField $cells[$i] } else { '' }
    }
    [void]$sb.AppendLine(($fields -join ','))
    $written++
  }

  # UTF-8 with NO byte-order mark. Export-Csv -Encoding UTF8 writes one under PS 5.1,
  # and papaparse would hand the first header back as "﻿Serial number" — the
  # lookup misses, every serial reads blank, and the import drops every row.
  [System.IO.File]::WriteAllText($Out, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "$written data rows -> $Out"
}
finally { $zip.Dispose() }
